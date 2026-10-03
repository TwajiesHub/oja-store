import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, fonts, minTouch } from '@/lib/theme'

type Props = { label: string; selected: boolean; onPress: () => void; disabled?: boolean }

// A filter or option chip: 48dp tall so it is easy to hit.
export default function Chip({ label, selected, onPress, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouch,
    minWidth: minTouch,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.field,
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  disabled: { backgroundColor: colors.stone },
  label: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
  selectedLabel: { color: colors.paper },
  disabledLabel: { color: colors.mute, textDecorationLine: 'line-through' },
})
