import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import BagLine from '@/components/BagLine'
import BrandChip from '@/components/BrandChip'
import Button from '@/components/Button'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { useAuth } from '@/lib/auth'
import { useBag } from '@/lib/bag'
import { API_URL } from '@/lib/env'
import { formatNaira } from '@/lib/money'
import { colors, fonts, gutter } from '@/lib/theme'
import type { BagLine as Line } from '@/lib/types'

function groupByBrand(lines: Line[]) {
  const groups = new Map<string, { brand: Line['brand']; lines: Line[] }>()
  for (const line of lines) {
    const group = groups.get(line.brand.slug) ?? { brand: line.brand, lines: [] }
    group.lines.push(line)
    groups.set(line.brand.slug, group)
  }
  return [...groups.values()]
}

function deliveryHint(remainingKobo: number): string {
  if (remainingKobo === 0) return 'You have unlocked free standard delivery in Lagos.'
  return `You're ${formatNaira(remainingKobo)} away from free Lagos delivery.`
}

export default function Bag() {
  const { session, loading: authLoading } = useAuth()
  const { quote, status, flashIds, updatedElsewhere, droppedSome, setQuantity, remove, reload } = useBag()

  let body
  if (authLoading) {
    body = <Loading />
  } else if (!session) {
    body = (
      <View style={styles.box}>
        <Text style={styles.lead}>Sign in to see your bag. It is the same bag you have on the website.</Text>
        <Button label="Go to Account" onPress={() => router.navigate('/account')} />
      </View>
    )
  } else if (!quote && status === 'error') {
    body = <ErrorState onRetry={reload} />
  } else if (!quote) {
    body = <Loading />
  } else if (quote.lines.length === 0) {
    body = (
      <>
        {droppedSome ? <Text style={styles.notice}>Something in your bag is no longer sold, so we removed it.</Text> : null}
        <EmptyState title="Your bag is empty." note="Start with the brands, or an edit." />
        <Button label="SEE THE SHOP ↗" onPress={() => router.navigate('/')} />
      </>
    )
  } else {
    const groups = groupByBrand(quote.lines)
    const hasSoldOut = quote.lines.some((line) => line.issue === 'sold_out')
    body = (
      <>
        {droppedSome ? <Text style={styles.notice}>Something in your bag is no longer sold, so we removed it.</Text> : null}
        {groups.map(({ brand, lines }) => (
          <View key={brand.slug} style={styles.group} accessibilityLabel={brand.name}>
            <BrandChip brand={brand} />
            {lines.map((line) => (
              <BagLine
                key={line.variant_id}
                line={line}
                flash={flashIds.has(line.variant_id)}
                onQuantity={(value) => setQuantity(line.variant_id, value)}
                onRemove={() => remove(line.variant_id)}
              />
            ))}
          </View>
        ))}

        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.h2}>Summary</Text>
            <Text style={styles.label}>
              {quote.item_count} {quote.item_count === 1 ? 'item' : 'items'} · {groups.length} {groups.length === 1 ? 'brand' : 'brands'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.rowValue}>{formatNaira(quote.subtotal_kobo)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Delivery</Text>
            <Text style={styles.rowValue}>At checkout</Text>
          </View>
          <Text style={styles.hint}>{deliveryHint(quote.free_delivery_remaining_kobo)}</Text>
          <Button
            label="CHECKOUT ↗"
            variant={hasSoldOut ? 'outline' : 'solid'}
            onPress={() => {
              if (!hasSoldOut) Linking.openURL(`${API_URL}/bag`)
            }}
          />
          {hasSoldOut ? <Text style={styles.fine}>Remove the sold-out items to check out.</Text> : null}
          <Text style={styles.fine}>You'll finish checkout on the website, signed in with the same Google account. Your bag will be waiting.</Text>
        </View>
      </>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.ink} />}
      >
        <Text accessibilityRole="header" style={styles.title}>
          Your bag
        </Text>
        <View style={styles.syncSlot}>
          {updatedElsewhere ? (
            <Text accessibilityLiveRegion="polite" style={styles.sync}>
              Updated from your other device
            </Text>
          ) : null}
        </View>
        {body}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: gutter, paddingTop: 24, paddingBottom: 40, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink },
  // Reserved height, so the line appearing and disappearing never moves the bag below it.
  syncSlot: { minHeight: 18 },
  sync: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
  box: { gap: 16, paddingTop: 12 },
  lead: { fontFamily: fonts.accent, fontSize: 20, lineHeight: 28, color: colors.ink },
  notice: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.mute },
  group: { gap: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  summary: { backgroundColor: colors.stone, padding: 16, gap: 12, marginTop: 16 },
  summaryHead: { gap: 4 },
  h2: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  label: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.mute },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  rowValue: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mute },
  fine: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.mute },
})
