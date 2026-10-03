import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/lib/theme'

type Props = { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; contentStyle?: ViewStyle }

// The body of a pushed screen (the stack's own header already handles the top inset).
export default function ScreenScroll({ children, onRefresh, refreshing = false, contentStyle }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[{ paddingBottom: insets.bottom + 40 }, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({ scroll: { flex: 1, backgroundColor: colors.paper } })
