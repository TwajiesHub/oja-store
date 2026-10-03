import { router, useLocalSearchParams } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ProductImage } from '@/components/ProductCard'
import ScreenScroll from '@/components/ScreenScroll'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { ApiError } from '@/lib/api'
import { formatNaira } from '@/lib/money'
import { colors, fonts, gutter } from '@/lib/theme'
import type { EditDetail, EditItem } from '@/lib/types'
import { useApi } from '@/lib/useApi'
import { isApparelSize } from '@/lib/variants'

// An edit curates a specific variant (Wine, 250 ml), so it joins the name. A size is the
// shopper's choice, so it stays off the name.
function itemTitle(item: EditItem): string {
  const { product, default_variant: variant } = item
  if (product.variant_labels.length < 2 || isApparelSize(variant.label)) return product.name
  return `${product.name}, ${variant.label}`
}

function Piece({ item, number }: { item: EditItem; number: number }) {
  const { product } = item
  const price = item.needs_size
    ? `${product.price_varies ? 'from ' : ''}${formatNaira(product.from_price_kobo)}`
    : formatNaira(item.default_variant.price_kobo)
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${itemTitle(item)}, ${price}${item.available ? '' : ', sold out'}`}
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
      style={({ pressed }) => [styles.piece, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.number}>N° {String(number).padStart(2, '0')}</Text>
      <ProductImage product={product} />
      <Text style={styles.note}>“{item.note}”</Text>
      <Text style={styles.pieceName}>{itemTitle(item)}</Text>
      <Text style={styles.price}>{item.available ? price : 'Sold out'}</Text>
    </Pressable>
  )
}

export default function EditPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: edit, error, loading, reload } = useApi<EditDetail>(`/edits/${slug}`)

  if (loading) return <Loading />
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState title="We couldn't find that edit" note="Try the Shop tab." />
  }
  if (error || !edit) return <ErrorState onRetry={reload} />

  return (
    <ScreenScroll onRefresh={reload}>
      <View style={[styles.hero, { backgroundColor: edit.accent }]}>
        <Text style={[styles.label, { color: edit.accent_text }]}>{edit.kicker}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: edit.accent_text }]}>
          {edit.title}
        </Text>
        <Text style={[styles.intro, { color: edit.accent_text }]}>{edit.intro}</Text>
        <Text style={[styles.label, { color: edit.accent_text }]}>
          {edit.piece_count} pieces{edit.available_count > 0 ? ` · ${formatNaira(edit.total_kobo)} for the lot` : ''}
        </Text>
      </View>
      <View style={styles.pieces}>
        {edit.items.map((item) => (
          <Piece key={item.position} item={item} number={item.position} />
        ))}
      </View>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  hero: { padding: gutter, paddingVertical: 32, gap: 12 },
  label: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42 },
  intro: { fontFamily: fonts.accent, fontSize: 19, lineHeight: 27 },
  pieces: { padding: gutter, gap: 32 },
  piece: { gap: 6 },
  number: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, color: colors.mute },
  note: { fontFamily: fonts.accent, fontSize: 17, lineHeight: 24, color: colors.ink, marginTop: 6 },
  pieceName: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  price: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.ink },
})
