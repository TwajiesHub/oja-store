import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import ProductGrid from '@/components/ProductGrid'
import ScreenScroll from '@/components/ScreenScroll'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { isLightKit, kitFor, kitText } from '@/lib/brandKit'
import { colors, fonts, gutter } from '@/lib/theme'
import type { BrandDetail } from '@/lib/types'
import { ApiError } from '@/lib/api'
import { useApi } from '@/lib/useApi'

export default function BrandPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: brand, error, loading, reload } = useApi<BrandDetail>(`/brands/${slug}`)

  if (loading) return <Loading />
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState title="We couldn't find that brand" note="It may have moved. Try the Shop tab." />
  }
  if (error || !brand) return <ErrorState onRetry={reload} />

  const kit = kitFor(brand.type_pairing)
  return (
    <ScreenScroll onRefresh={reload}>
      <View style={[styles.hero, { backgroundColor: brand.accent }, isLightKit(brand) && styles.outlined]}>
        <Text style={[styles.label, { color: brand.accent_text }]}>
          {brand.descriptor} · {brand.city}
        </Text>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[kitText(brand.type_pairing, 64 * kit.heroScale), { color: brand.accent_text, includeFontPadding: false }]}
        >
          {brand.name}
        </Text>
        <Text style={[styles.tagline, { color: brand.accent_text }]}>{brand.tagline}</Text>
      </View>

      <View style={styles.about}>
        <Text style={styles.label}>About the brand</Text>
        <Text style={[kitText(brand.type_pairing, 26), styles.slogan]}>{brand.slogan}</Text>
        <Text style={styles.story}>{brand.story}</Text>
        {brand.edits.map((edit) => (
          <Link key={edit.slug} href={{ pathname: '/edit/[slug]', params: { slug: edit.slug } }} asChild>
            <Pressable accessibilityRole="link" style={styles.editLink}>
              <Text style={styles.editLinkText}>Also in {edit.title.replace(/^The /, 'the ')} ↗</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <View style={styles.products}>
        <Text accessibilityRole="header" style={styles.h2}>
          The pieces
        </Text>
        {brand.products.length === 0 ? <EmptyState title="Nothing here yet" /> : <ProductGrid products={brand.products} />}
      </View>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  hero: { minHeight: 240, padding: gutter, justifyContent: 'flex-end', gap: 8 },
  outlined: { borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.mute },
  tagline: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  about: { padding: gutter, gap: 12, paddingTop: 28 },
  slogan: { color: colors.ink, lineHeight: 32 },
  story: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: colors.ink },
  editLink: { minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.line },
  editLinkText: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink },
  products: { paddingHorizontal: gutter, paddingTop: 8, gap: 16 },
  h2: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
})
