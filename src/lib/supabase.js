// The browser uses Supabase only for Google sign-in and the session. Every other piece of
// data goes through our own API.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase =
  url && publishableKey
    ? createClient(url, publishableKey, {
        // PKCE: Google sends back a short code that is swapped for the session, so no token
        // ever appears in the address bar.
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export const authAvailable = supabase !== null

// Signs in with Google and comes back to `returnPath` on this same site, so the redirect is
// right on localhost, on a Vercel preview and in production.
export async function signInWithGoogle(returnPath) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${returnPath}` },
  })
  if (error) throw error
}

export async function signOutOfSupabase() {
  await supabase.auth.signOut()
}

export async function getAccessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function refreshAccessToken() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.refreshSession()
  return error ? null : data.session?.access_token ?? null
}
