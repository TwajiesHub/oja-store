import { StyleSheet, Text } from 'react-native'

import Screen from '@/components/Screen'
import { colors, fonts } from '@/lib/theme'

export default function Bag() {
  return (
    <Screen title="Bag">
      <Text style={styles.note}>Your bag will show here, in step with the website.</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({ note: { fontFamily: fonts.accent, fontSize: 20, lineHeight: 28, color: colors.mute } })
