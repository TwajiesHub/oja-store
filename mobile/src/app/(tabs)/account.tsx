import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Button from '@/components/Button'
import Screen from '@/components/Screen'
import { useAuth } from '@/lib/auth'
import { colors, fonts } from '@/lib/theme'

export default function Account() {
  const { session, loading, profile, profileState, redirectTo, signIn, signOut, reloadProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSignIn() {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await signIn())
    } catch {
      setMessage('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // The redirect and user_id lines are for checking sign-in, so they only exist in development builds.
  const devLines = __DEV__ ? (
    <View style={styles.dev}>
      <Text style={styles.devText}>Redirect: {redirectTo}</Text>
      {profile ? <Text style={styles.devText}>user_id: {profile.user_id}</Text> : null}
    </View>
  ) : null

  if (loading) {
    return (
      <Screen title="Account">
        <Text style={styles.mute}>Loading…</Text>
      </Screen>
    )
  }

  if (!session) {
    return (
      <Screen title="Account">
        <Text style={styles.lead}>Sign in with the same Google account you use on the website, and your bag follows you.</Text>
        <Button label="Continue with Google" onPress={handleSignIn} busy={busy} />
        {message ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {message}
          </Text>
        ) : null}
        {devLines}
      </Screen>
    )
  }

  return (
    <Screen title="Account">
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{profile?.email ?? session.user.email}</Text>
        {profile?.full_name ? <Text style={styles.mute}>{profile.full_name}</Text> : null}
      </View>

      {profileState === 'loading' ? <Text style={styles.mute}>Checking with the shop…</Text> : null}
      {profileState === 'ready' ? <Text style={styles.ok}>Connected to the shop: your account is recognised.</Text> : null}
      {profileState === 'error' ? (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={styles.error}>
            Signed in, but the shop could not be reached.
          </Text>
          <Button label="Try again" variant="outline" onPress={reloadProfile} />
        </View>
      ) : null}

      <Button label="Sign out" variant="outline" onPress={signOut} />
      {devLines}
    </Screen>
  )
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.accent, fontSize: 20, lineHeight: 28, color: colors.ink },
  mute: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  error: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.error },
  ok: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ok },
  card: { backgroundColor: colors.stone, padding: 16, gap: 6 },
  label: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.mute },
  value: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
  dev: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, gap: 4 },
  devText: { fontFamily: fonts.mono, fontSize: 11, color: colors.mute },
})
