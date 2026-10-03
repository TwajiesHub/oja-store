import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import { useAuth } from '@/lib/auth'

// The website's /app-callback page forwards Google's sign-in result to the app's own address,
// which opens this screen. It swaps the code for a session (once, even if openAuthSessionAsync
// has already done it) and sends the user to Account.
export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>()
  const { completeSignIn } = useAuth()

  useEffect(() => {
    if (code || error_description) completeSignIn({ code, error_description })
  }, [code, error_description, completeSignIn])

  return <Redirect href="/account" />
}
