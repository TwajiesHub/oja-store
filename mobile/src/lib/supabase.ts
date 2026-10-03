// The app uses Supabase only for Google sign-in and the session, like the website.
// Every other piece of data goes through our own API (see api.ts).
import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    // The sign-in code is read from the deep link by hand (see auth.tsx), not from a web URL.
    detectSessionInUrl: false,
  },
})

// Refresh tokens only while the app is on screen.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
supabase.auth.startAutoRefresh()
