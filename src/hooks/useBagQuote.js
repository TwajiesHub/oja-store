import { useCallback, useEffect, useState } from 'react'

import { apiPost } from '../lib/api.js'

// Asks the server to price the bag. Only ids and quantities are sent. The previous quote stays
// on screen while a new one loads, so the page does not flash on every quantity change.
export default function useBagQuote(items) {
  const key = JSON.stringify(items.map(({ variant_id, quantity }) => ({ variant_id, quantity })))
  const [state, setState] = useState({ quote: null, error: null, loading: items.length > 0 })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const requestItems = JSON.parse(key)
    if (requestItems.length === 0) {
      setState({ quote: null, error: null, loading: false })
      return undefined
    }

    let cancelled = false
    setState((previous) => ({ ...previous, error: null, loading: true }))
    apiPost('/bag/quote', { items: requestItems })
      .then((quote) => !cancelled && setState({ quote, error: null, loading: false }))
      .catch((error) => !cancelled && setState((previous) => ({ ...previous, error, loading: false })))
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, reload }
}
