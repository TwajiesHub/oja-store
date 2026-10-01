import { useCallback, useEffect, useState } from 'react'

import { apiGet } from '../lib/api.js'

// Loads one API path. `auth` sends the signed-in user's token; `skip` waits (for example until
// sign-in is known). `reload` tries again after an error.
export default function useApi(path, { auth = false, skip = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !skip })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (skip) {
      setState({ data: null, error: null, loading: false })
      return undefined
    }
    let cancelled = false
    setState({ data: null, error: null, loading: true })
    apiGet(path, { auth })
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
  }, [path, auth, skip, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, reload }
}
