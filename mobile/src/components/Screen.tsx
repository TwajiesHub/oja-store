import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, fonts, gutter } from '@/lib/theme'

export default function Screen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: gutter, paddingTop: 24, paddingBottom: 40 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink },
  body: { marginTop: 20, gap: 16 },
})
