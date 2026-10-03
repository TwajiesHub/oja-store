// Sign-in state for the whole app: the Supabase session, and the account the backend sees.
import type { Session } from '@supabase/supabase-js'
import { makeRedirectUri } from 'expo-auth-session'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { apiGet } from './api'
import { API_URL } from './env'
import { supabase } from './supabase'

WebBrowser.maybeCompleteAuthSession()

export type Profile = { user_id: string; email: string; full_name: string }
type ReturnedParams = { code?: string; error_description?: string }
type ProfileState = 'idle' | 'loading' | 'ready' | 'error'

type AuthValue = {
  session: Session | null
  loading: boolean
  profile: Profile | null
  profileState: ProfileState
  redirectTo: string
  signIn: () => Promise<string | null>
  completeSignIn: (returned: ReturnedParams) => Promise<string | null>
  signOut: () => Promise<void>
  reloadProfile: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

// The app's own address, which the sign-in finally returns to: exp://…/--/auth-callback in Expo Go,
// oja://auth-callback in the installed app. Both are allowed in Supabase.
const appLink = makeRedirectUri({ scheme: 'oja', path: 'auth-callback' })

// What Supabase is told. It redirects to the website's /app-callback page (an https address that
// Supabase always accepts), and that page forwards the code to `appLink`, passed in `to`.
const redirectTo = `${API_URL}/app-callback?to=${encodeURIComponent(appLink)}`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileState, setProfileState] = useState<ProfileState>('idle')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (__DEV__) console.log('[auth] redirectTo =', redirectTo, '| appLink =', appLink)
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

  // A code can be used once, and it reaches the app twice (the browser session resolves, and the
  // deep link opens the auth-callback screen). Both call this, and the second shares the first's work.
  const exchanges = useRef(new Map<string, Promise<string | null>>())
  const completeSignIn = useCallback(async ({ code, error_description }: ReturnedParams) => {
    if (!code) return error_description ?? 'Google did not return a sign-in code. Please try again.'
    let exchange = exchanges.current.get(code)
    if (!exchange) {
      exchange = supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => (error ? 'Sign-in could not be completed. Please try again.' : null))
      exchanges.current.set(code, exchange)
    }
    return exchange
  }, [])

  // Returns an error message for the shopper, or null on success or when they just closed the tab.
  const signIn = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data.url) return 'Could not start Google sign-in. Please try again.'
    if (__DEV__) console.log('[auth] code_challenge_method =', new URL(data.url).searchParams.get('code_challenge_method'))

    // Always the system browser (Chrome Custom Tabs on Android), never an embedded WebView:
    // Google blocks sign-in inside a WebView with "disallowed_useragent". It resolves when the
    // website's /app-callback page opens `appLink`.
    const result = await WebBrowser.openAuthSessionAsync(data.url, appLink)
    if (result.type !== 'success') return null

    const returned = Linking.parse(result.url).queryParams ?? {}
    return completeSignIn({
      code: typeof returned.code === 'string' ? returned.code : undefined,
      error_description: typeof returned.error_description === 'string' ? returned.error_description : undefined,
    })
  }, [completeSignIn])

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
      completeSignIn,
      signOut,
      reloadProfile: () => setReloadCount((count) => count + 1),
    }),
    [session, loading, profile, profileState, signIn, completeSignIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
