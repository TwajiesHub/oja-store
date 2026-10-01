import { useContext } from 'react'

import { AuthContext } from '../lib/authContext.js'

// The signed-in user (or null), and the two things you can do about it. Components use
// this instead of talking to Supabase directly.
export default function useAuth() {
  return useContext(AuthContext)
}
