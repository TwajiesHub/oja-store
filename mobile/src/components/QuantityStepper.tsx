import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, fonts, minTouch } from '@/lib/theme'

type Props = { value: number; max: number; onChange: (value: number) => void }

export default function QuantityStepper({ value, max, onChange }: Props) {
  return (
    <View style={styles.box} accessibilityRole="adjustable" accessibilityLabel={`Quantity ${value}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        disabled={value <= 1}
        onPress={() => onChange(value - 1)}
        style={styles.button}
      >
        <Text style={[styles.symbol, value <= 1 && styles.off]}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={styles.button}
      >
        <Text style={[styles.symbol, value >= max && styles.off]}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, alignSelf: 'flex-start' },
  button: { width: minTouch, height: minTouch + 4, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  off: { color: colors.line },
  value: { minWidth: 32, textAlign: 'center', fontFamily: fonts.monoMedium, fontSize: 16, color: colors.ink },
})
