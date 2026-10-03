import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import Button from './Button'
import { colors, fonts } from '@/lib/theme'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.box} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.ink} />
      <Text style={styles.mute}>{label}</Text>
    </View>
  )
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <View style={styles.box}>
      <Text accessibilityRole="alert" style={styles.title}>
        {message ?? 'Something went wrong.'}
      </Text>
      <Text style={styles.mute}>Check your connection and try again.</Text>
      <Button label="Try again" variant="outline" onPress={onRetry} />
    </View>
  )
}

export function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.mute}>{note}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 24 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, textAlign: 'center' },
  mute: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, textAlign: 'center' },
})
