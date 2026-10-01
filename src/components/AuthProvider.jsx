import { useCallback, useEffect, useMemo, useState } from 'react'

import { AuthContext } from '../lib/authContext.js'
import { authAvailable, signInWithGoogle, signOutOfSupabase, supabase } from '../lib/supabase.js'

function toUser(session) {
  if (!session) return null
  const { id, email, user_metadata: metadata = {} } = session.user
  const name = metadata.full_name || metadata.name || email || ''
  return { id, email: email || '', name, initial: (name || '?').trim().charAt(0).toUpperCase() }
}

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ session: null, loading: authAvailable })

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }))
    // Only store the session here. Calling Supabase again from inside this callback can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }))
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = useCallback((returnPath) => signInWithGoogle(returnPath), [])
  const signOut = useCallback(() => signOutOfSupabase(), [])

  const value = useMemo(
    () => ({ user: toUser(state.session), loading: state.loading, available: authAvailable, signIn, signOut }),
    [state, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
