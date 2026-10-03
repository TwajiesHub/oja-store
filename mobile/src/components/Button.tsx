import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

import { colors, fonts, minTouch } from '@/lib/theme'

type Props = { label: string; onPress: () => void; busy?: boolean; variant?: 'solid' | 'outline' }

export default function Button({ label, onPress, busy = false, variant = 'solid' }: Props) {
  const solid = variant === 'solid'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, solid ? styles.solid : styles.outline, pressed && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator color={solid ? colors.paper : colors.ink} />
      ) : (
        <Text style={[styles.label, { color: solid ? colors.paper : colors.ink }]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: minTouch + 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  solid: { backgroundColor: colors.ink },
  outline: { borderWidth: 1, borderColor: colors.ink },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 0.3 },
})
