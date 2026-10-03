// Sign-in state for the whole app: the Supabase session, and the account the backend sees.
import type { Session } from '@supabase/supabase-js'
import { makeRedirectUri } from 'expo-auth-session'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { apiGet } from './api'
import { supabase } from './supabase'

WebBrowser.maybeCompleteAuthSession()

export type Profile = { user_id: string; email: string; full_name: string }
type ProfileState = 'idle' | 'loading' | 'ready' | 'error'

type AuthValue = {
  session: Session | null
  loading: boolean
  profile: Profile | null
  profileState: ProfileState
  redirectTo: string
  signIn: () => Promise<string | null>
  signOut: () => Promise<void>
  reloadProfile: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

// Where Google should send the user back to. In Expo Go this is an exp://…/--/auth-callback
// address, in the installed app it is oja://auth-callback. Both are allowed in Supabase.
const redirectTo = makeRedirectUri({ scheme: 'oja', path: 'auth-callback' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileState, setProfileState] = useState<ProfileState>('idle')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (__DEV__) console.log('[auth] redirectTo =', redirectTo)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  // Ask our own backend who this is. The same account on the website gives the same user_id.
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileState('idle')
      return
    }
    let cancelled = false
    setProfileState('loading')
    apiGet<Profile>('/me', { auth: true })
      .then((found) => {
        if (cancelled) return
        setProfile(found)
        setProfileState('ready')
      })
      .catch(() => {
        if (!cancelled) setProfileState('error')
      })
    return () => {
      cancelled = true
    }
  }, [userId, reloadCount])

  // Returns an error message for the shopper, or null on success or when they just closed the tab.
  const signIn = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data.url) return 'Could not start Google sign-in. Please try again.'

    // Always the system browser (Chrome Custom Tabs on Android), never an embedded WebView:
    // Google blocks sign-in inside a WebView with "disallowed_useragent".
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success') return null

    const returned = Linking.parse(result.url)
    const code = returned.queryParams?.code
    if (typeof code !== 'string') {
      const reason = returned.queryParams?.error_description
      return typeof reason === 'string' ? reason : 'Google did not return a sign-in code. Please try again.'
    }
    const exchanged = await supabase.auth.exchangeCodeForSession(code)
    return exchanged.error ? 'Sign-in could not be completed. Please try again.' : null
  }, [])

  // "local" signs out this device only; the website and other devices stay signed in.
  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      profile,
      profileState,
      redirectTo,
      signIn,
      signOut,
      reloadProfile: () => setReloadCount((count) => count + 1),
    }),
    [session, loading, profile, profileState, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
