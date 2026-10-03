import { Redirect } from 'expo-router'

// Google's sign-in return link opens the app at /auth-callback. The code in it is read by
// openAuthSessionAsync in lib/auth.tsx, so this screen only has to send the user on.
export default function AuthCallback() {
  return <Redirect href="/account" />
}
