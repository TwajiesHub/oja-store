import { createContext } from 'react'

// What useAuth() returns: { user, loading, available, signIn, signOut }.
export const AuthContext = createContext(null)
