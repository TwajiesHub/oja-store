// Keeps the browser bag and the signed-in user's saved bag in step.
//
// Signed out, the bag lives only in this browser. When someone signs in:
//   - if this browser's bag already belongs to them (a mirror of their saved bag), the saved bag
//     is loaded and wins;
//   - otherwise it is a guest bag, and it is merged into the saved bag on the server (quantities
//     add up, capped at stock and 10). Merging a mirror would double every quantity, which is
//     why the owner is remembered.
// After that the shopper's actions go to the server one item at a time (POST, PATCH, DELETE on
// /bag/items), never as a snapshot of the whole bag, so another device's items can't be wiped
// out. Changes made on other devices arrive through Supabase Realtime, which only says "the bag
// changed"; this file then re-fetches the priced bag from the API. Signing out empties the
// browser bag so the next person on a shared device starts fresh.
import { apiDelete, apiGet, apiPatch, apiPost } from './api.js'
import { clearBag, getItems, replaceItems, setRemote } from './bagStore.js'
import { supabase } from './supabase.js'

const OWNER_KEY = 'oja.bag.owner'
const REFETCH_DELAY_MS = 250
const RETRY_DELAY_MS = 2000
const MAX_ATTEMPTS = 3

function readOwner() {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function writeOwner(userId) {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId)
    else localStorage.removeItem(OWNER_KEY)
  } catch {
    // Without storage the bag simply starts again as a guest bag on the next visit.
  }
}

function toRequest(items) {
  return { items: items.map(({ variant_id, quantity }) => ({ variant_id, quantity })) }
}

// The saved bag becomes the browser bag. Prices the shopper already saw are kept, so the
// bag page can still say when one changed.
function adoptSavedBag(quote) {
  const seen = new Map(getItems().map((item) => [item.variant_id, item.seen_price_kobo]))
  replaceItems(
    quote.lines.map((line) => ({
      variant_id: line.variant_id,
      quantity: line.requested_quantity,
      seen_price_kobo: seen.get(line.variant_id) ?? line.unit_price_kobo,
    })),
  )
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Starts syncing for `userId` (or the signed-out state when null). Returns a function that stops it.
export function startBagSync(userId) {
  let stopped = false
  let refetchTimer = null
  let stopLive = () => {}

  if (!userId) {
    if (readOwner()) {
      clearBag()
      writeOwner(null)
    }
    return () => {}
  }

  // The shopper's own changes go out one after another, so the last answer reflects all of them.
  // While any are on their way, a re-fetch would overwrite what the shopper just did, so it waits.
  let pending = 0
  let queue = Promise.resolve()
  let refetchWanted = false
  let epoch = 0

  async function refetch() {
    if (stopped) return
    if (pending > 0) {
      refetchWanted = true
      return
    }
    const startedAt = epoch
    try {
      const quote = await apiGet('/bag', { auth: true })
      // Drop the answer if the shopper changed something while it was on its way.
      if (!stopped && startedAt === epoch && pending === 0) adoptSavedBag(quote)
    } catch {
      // The next event, or the tab coming back, tries again.
    }
  }

  function scheduleRefetch() {
    clearTimeout(refetchTimer)
    refetchTimer = setTimeout(refetch, REFETCH_DELAY_MS)
  }

  function send(call) {
    epoch += 1
    pending += 1
    queue = queue.then(async () => {
      let failed = false
      let quote = null
      try {
        quote = await call()
      } catch {
        failed = true
      }
      pending -= 1
      if (stopped) return
      if (pending > 0) return
      // Everything the shopper did is saved: show the server's answer. If a call failed, the
      // server's bag is the truth, so fetching it rolls the screen back.
      if (failed || refetchWanted) {
        refetchWanted = false
        await refetch()
      } else if (quote) {
        adoptSavedBag(quote)
      }
    })
  }

  const handlers = {
    add: (variantId, quantity) =>
      send(() => apiPost('/bag/items', { variant_id: variantId, quantity }, { auth: true })),
    setQuantity: (variantId, quantity) =>
      send(() => apiPatch(`/bag/items/${variantId}`, { quantity }, { auth: true })),
    remove: (variantId) => send(() => apiDelete(`/bag/items/${variantId}`, { auth: true })),
  }

  // Realtime: INSERT and UPDATE can be filtered to this user's rows. A DELETE event can't be
  // filtered by row, so any delete just triggers a (cheap, harmless) re-fetch.
  function listenForChanges() {
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefetch()
    }
    document.addEventListener('visibilitychange', onVisible)

    let channel = null
    if (supabase) {
      let wasConnected = false
      const table = { schema: 'public', table: 'bag_items' }
      channel = supabase
        .channel(`bag-${userId}`)
        .on('postgres_changes', { event: 'INSERT', ...table, filter: `user_id=eq.${userId}` }, scheduleRefetch)
        .on('postgres_changes', { event: 'UPDATE', ...table, filter: `user_id=eq.${userId}` }, scheduleRefetch)
        .on('postgres_changes', { event: 'DELETE', ...table }, scheduleRefetch)
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return
          // After a reconnect, changes may have been missed while the channel was down.
          if (wasConnected) scheduleRefetch()
          wasConnected = true
        })
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) supabase.removeChannel(channel)
    }
  }

  async function begin() {
    // A bag that mirrors someone else's saved bag must never be merged into this user's.
    const owner = readOwner()
    if (owner && owner !== userId) {
      clearBag()
      writeOwner(null)
    }
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !stopped; attempt += 1) {
      try {
        const quote =
          readOwner() === userId
            ? await apiGet('/bag', { auth: true })
            : await apiPost('/bag/merge', toRequest(getItems()), { auth: true })
        if (stopped) return
        adoptSavedBag(quote)
        writeOwner(userId)
        setRemote(handlers)
        stopLive = listenForChanges()
        return
      } catch {
        await wait(RETRY_DELAY_MS)
      }
    }
  }

  begin()
  return () => {
    stopped = true
    clearTimeout(refetchTimer)
    setRemote(null)
    stopLive()
  }
}
