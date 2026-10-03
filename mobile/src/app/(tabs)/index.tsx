import { StyleSheet, Text } from 'react-native'

import Screen from '@/components/Screen'
import { colors, fonts } from '@/lib/theme'

export default function Shop() {
  return (
    <Screen title="Shop">
      <Text style={styles.note}>Six Nigerian brands, one bag. The catalogue arrives in the next milestone.</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({ note: { fontFamily: fonts.accent, fontSize: 20, lineHeight: 28, color: colors.mute } })
