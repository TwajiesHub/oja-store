// The signed-in user's bag, kept in step with the website and any other device.
//
// There is no bag stored in the app: the screen shows the server's priced quote (GET /api/bag).
//   - The shopper's own changes go out one item at a time (POST, PATCH, DELETE /api/bag/items), in
//     order, and show instantly (optimistic). If one fails, the server's bag is fetched to roll back.
//   - Changes made elsewhere arrive through Supabase Realtime on `bag_items`. It only says "your bag
//     changed"; the app then re-fetches the bag. A re-fetch is held back while the shopper's own
//     calls are in flight, so an echo can never overwrite what they just did.
//   - The channel always uses the current access token. When the session is refreshed (including
//     coming back from the background) the token is handed to Realtime, a channel that is not
//     joined is rebuilt, and the bag is re-fetched, so sync cannot quietly stop after the token expires.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'

import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './api'
import { useAuth } from './auth'
import { diffBags, hasChange, withoutLine, withQuantity } from './bagLogic'
import { supabase } from './supabase'
import type { BagQuote } from './types'

const REFETCH_DELAY_MS = 250
const FLASH_MS = 1500
const NOTE_MS = 3000
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 15000]

type Status = 'idle' | 'loading' | 'ready' | 'error'

type BagValue = {
  quote: BagQuote | null
  status: Status
  count: number
  // Lines another device just changed (flash), and whether to show the "updated" line.
  flashIds: ReadonlySet<number>
  updatedElsewhere: boolean
  // True once if the server dropped something that is no longer sold.
  droppedSome: boolean
  add: (variantId: number, quantity: number) => Promise<ApiError | Error | null>
  setQuantity: (variantId: number, quantity: number) => void
  remove: (variantId: number) => void
  reload: () => void
}

const BagContext = createContext<BagValue | null>(null)
const NO_IDS: ReadonlySet<number> = new Set()

export function BagProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [quote, setQuote] = useState<BagQuote | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [flashIds, setFlashIds] = useState<ReadonlySet<number>>(NO_IDS)
  const [updatedElsewhere, setUpdatedElsewhere] = useState(false)
  const [droppedSome, setDroppedSome] = useState(false)

  // The latest quote, readable from callbacks without re-creating them.
  const quoteRef = useRef<BagQuote | null>(null)
  const run = useRef({ pending: 0, queue: Promise.resolve(), refetchWanted: false, rollback: false, epoch: 0 })
  const syncRef = useRef<{ reload: () => void; send: (call: () => Promise<BagQuote>) => Promise<ApiError | Error | null> } | null>(null)

  const show = useCallback((next: BagQuote | null) => {
    quoteRef.current = next
    setQuote(next)
  }, [])

  useEffect(() => {
    // Signed out, or a different person: nothing of the previous bag stays.
    show(null)
    setFlashIds(NO_IDS)
    setUpdatedElsewhere(false)
    setDroppedSome(false)
    run.current = { pending: 0, queue: Promise.resolve(), refetchWanted: false, rollback: false, epoch: run.current.epoch + 1 }
    syncRef.current = null
    if (!userId) {
      setStatus('idle')
      return
    }

    let stopped = false
    let refetchTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let flashTimer: ReturnType<typeof setTimeout> | null = null
    let noteTimer: ReturnType<typeof setTimeout> | null = null
    let channel: RealtimeChannel | null = null
    let generation = 0
    let attempts = 0
    setStatus('loading')

    // Fetches the bag. `external` fetches (Realtime, foreground, reconnect) are the ones that may
    // bring changes from another device, so they alone flash lines and show the "updated" line.
    async function refetch(external: boolean) {
      if (stopped) return
      if (run.current.pending > 0) {
        run.current.refetchWanted = true
        return
      }
      const startedAt = run.current.epoch
      try {
        const fresh = await apiGet<BagQuote>('/bag', { auth: true })
        // Drop the answer if the shopper changed something while it was on its way.
        if (stopped || startedAt !== run.current.epoch || run.current.pending > 0) return
        const before = quoteRef.current
        show(fresh)
        setStatus('ready')
        if (fresh.removed_variant_ids.length > 0) setDroppedSome(true)
        if (external && before) {
          const change = diffBags(before, fresh)
          if (hasChange(change)) announce(change.changedIds)
        }
      } catch {
        if (!stopped && !quoteRef.current) setStatus('error')
      }
    }

    function announce(changedIds: number[]) {
      setFlashIds(new Set(changedIds))
      setUpdatedElsewhere(true)
      if (flashTimer) clearTimeout(flashTimer)
      if (noteTimer) clearTimeout(noteTimer)
      flashTimer = setTimeout(() => setFlashIds(NO_IDS), FLASH_MS)
      noteTimer = setTimeout(() => setUpdatedElsewhere(false), NOTE_MS)
    }

    function scheduleRefetch() {
      if (refetchTimer) clearTimeout(refetchTimer)
      refetchTimer = setTimeout(() => refetch(true), REFETCH_DELAY_MS)
    }

    // The shopper's own calls run one after another; once the last one is done the server's answer
    // is shown (or, if any failed, the server's bag, which rolls the screen back).
    function send(call: () => Promise<BagQuote>): Promise<ApiError | Error | null> {
      const state = run.current
      state.epoch += 1
      state.pending += 1
      const task = state.queue.then(async () => {
        let failure: ApiError | Error | null = null
        let result: BagQuote | null = null
        try {
          result = await call()
        } catch (error) {
          failure = error as Error
          state.rollback = true
        }
        state.pending -= 1
        if (stopped || state !== run.current || state.pending > 0) return failure
        if (state.rollback || state.refetchWanted) {
          state.rollback = false
          state.refetchWanted = false
          await refetch(false)
        } else if (result) {
          show(result)
          setStatus('ready')
        }
        return failure
      })
      state.queue = task.then(
        () => undefined,
        () => undefined,
      )
      return task
    }

    // ----- Realtime -----
    function dropChannel() {
      generation += 1
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (channel) supabase.removeChannel(channel)
      channel = null
    }

    function scheduleReconnect() {
      if (stopped || reconnectTimer) return
      const delay = RECONNECT_DELAYS_MS[Math.min(attempts, RECONNECT_DELAYS_MS.length - 1)]
      attempts += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    function connect() {
      if (stopped) return
      dropChannel()
      const mine = generation
      const table = { schema: 'public', table: 'bag_items' }
      channel = supabase
        .channel(`bag-${userId}-${mine}`)
        .on('postgres_changes', { event: 'INSERT', ...table, filter: `user_id=eq.${userId}` }, scheduleRefetch)
        .on('postgres_changes', { event: 'UPDATE', ...table, filter: `user_id=eq.${userId}` }, scheduleRefetch)
        // A DELETE event can't be filtered by row, so any delete just triggers a (cheap) re-fetch.
        .on('postgres_changes', { event: 'DELETE', ...table }, scheduleRefetch)
        .subscribe((state) => {
          if (stopped || mine !== generation) return
          if (state === 'SUBSCRIBED') {
            attempts = 0
            // Anything that changed before the channel was up (or while it was down) is picked up now.
            scheduleRefetch()
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
            scheduleReconnect()
          }
        })
    }

    // Hand Realtime the newest token, rebuild a channel that is not joined, then re-fetch.
    async function refreshConnection() {
      if (stopped) return
      const { data } = await supabase.auth.getSession()
      if (stopped || !data.session) return
      await supabase.realtime.setAuth(data.session.access_token)
      if (channel?.state !== 'joined') connect()
      scheduleRefetch()
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, next) => {
      if (stopped || !next || next.user.id !== userId) return
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        supabase.realtime.setAuth(next.access_token).then(() => {
          if (stopped) return
          if (channel?.state !== 'joined') connect()
          scheduleRefetch()
        })
      }
    })
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshConnection()
    })

    syncRef.current = { reload: () => refetch(false), send }
    refetch(false)
    refreshConnection()

    return () => {
      stopped = true
      if (refetchTimer) clearTimeout(refetchTimer)
      if (flashTimer) clearTimeout(flashTimer)
      if (noteTimer) clearTimeout(noteTimer)
      dropChannel()
      authListener.subscription.unsubscribe()
      appState.remove()
    }
  }, [userId, show])

  const add = useCallback(async (variantId: number, quantity: number) => {
    const sync = syncRef.current
    if (!sync) return new Error('Not signed in')
    return sync.send(() => apiPost<BagQuote>('/bag/items', { variant_id: variantId, quantity }, { auth: true }))
  }, [])

  const setQuantity = useCallback(
    (variantId: number, quantity: number) => {
      const sync = syncRef.current
      if (!sync || !quoteRef.current) return
      show(withQuantity(quoteRef.current, variantId, quantity))
      const sent = quoteRef.current.lines.find((line) => line.variant_id === variantId)?.quantity ?? quantity
      sync.send(() => apiPatch<BagQuote>(`/bag/items/${variantId}`, { quantity: sent }, { auth: true }))
    },
    [show],
  )

  const remove = useCallback(
    (variantId: number) => {
      const sync = syncRef.current
      if (!sync || !quoteRef.current) return
      show(withoutLine(quoteRef.current, variantId))
      sync.send(() => apiDelete<BagQuote>(`/bag/items/${variantId}`, { auth: true }))
    },
    [show],
  )

  const reload = useCallback(() => {
    setStatus((current) => (quoteRef.current ? current : 'loading'))
    syncRef.current?.reload()
  }, [])

  const value = useMemo<BagValue>(
    () => ({
      quote,
      status,
      count: quote?.item_count ?? 0,
      flashIds,
      updatedElsewhere,
      droppedSome,
      add,
      setQuantity,
      remove,
      reload,
    }),
    [quote, status, flashIds, updatedElsewhere, droppedSome, add, setQuantity, remove, reload],
  )
  return <BagContext.Provider value={value}>{children}</BagContext.Provider>
}

export function useBag(): BagValue {
  const value = useContext(BagContext)
  if (!value) throw new Error('useBag must be used inside BagProvider')
  return value
}
