// Loads a GET endpoint with loading and error state. Answers are kept in memory for a minute, so
// going back to a screen is instant, and `reload` always asks the server again.
import { useCallback, useEffect, useState } from 'react'

import { apiGet, ApiError } from './api'

const FRESH_MS = 60_000
const cache = new Map<string, { data: unknown; at: number }>()

type State<T> = { data: T | null; error: ApiError | Error | null; loading: boolean; reload: () => void }

export function useApi<T>(path: string | null): State<T> {
  const cached = path ? cache.get(path) : undefined
  const [data, setData] = useState<T | null>((cached?.data as T | undefined) ?? null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(path !== null && !cached)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    if (!path) return
    const hit = cache.get(path)
    // A different path: never show the previous path's answer while this one loads.
    setData((hit?.data as T | undefined) ?? null)
    if (hit && reloads === 0 && Date.now() - hit.at < FRESH_MS) {
      setData(hit.data as T)
      setLoading(false)
      return
    }
    let cancelled = false
    setError(null)
    setLoading(!hit)
    apiGet<T>(path)
      .then((fresh) => {
        cache.set(path, { data: fresh, at: Date.now() })
        if (cancelled) return
        setData(fresh)
        setLoading(false)
      })
      .catch((failure: Error) => {
        if (cancelled) return
        setError(failure)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [path, reloads])

  const reload = useCallback(() => setReloads((count) => count + 1), [])
  return { data, error, loading, reload }
}
