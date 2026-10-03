import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import Chip from '@/components/Chip'
import ProductGrid from '@/components/ProductGrid'
import ScreenScroll from '@/components/ScreenScroll'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { colors, fonts, gutter } from '@/lib/theme'
import type { Brand, Category, ProductCardData } from '@/lib/types'
import { useApi } from '@/lib/useApi'

export default function ShopList() {
  const { category, brand } = useLocalSearchParams<{ category?: string; brand?: string }>()
  const categories = useApi<Category[]>('/categories')
  const brands = useApi<Brand[]>('/brands')

  const query = new URLSearchParams()
  if (category) query.set('category', category)
  if (brand) query.set('brand', brand)
  const products = useApi<ProductCardData[]>(`/products${query.size ? `?${query}` : ''}`)

  // Tapping the chip that is already selected clears that filter.
  const pick = (key: 'category' | 'brand', slug: string, current?: string) =>
    router.setParams({ [key]: current === slug ? undefined : slug })

  const reloadAll = () => [products, categories, brands].forEach((request) => request.reload())

  return (
    <ScreenScroll onRefresh={reloadAll}>
      <Text accessibilityRole="header" style={styles.title}>
        Shop
      </Text>

      <Text style={styles.filterLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(categories.data ?? []).map((item) => (
          <Chip key={item.slug} label={item.name} selected={category === item.slug} onPress={() => pick('category', item.slug, category)} />
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Brand</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(brands.data ?? []).map((item) => (
          <Chip key={item.slug} label={item.name} selected={brand === item.slug} onPress={() => pick('brand', item.slug, brand)} />
        ))}
      </ScrollView>

      <View style={styles.results}>
        {products.error ? (
          <ErrorState onRetry={products.reload} />
        ) : products.loading ? (
          <Loading />
        ) : (products.data ?? []).length === 0 ? (
          <EmptyState title="Nothing here yet" note="Try a different brand or category." />
        ) : (
          <>
            <Text style={styles.count}>{products.data?.length} pieces</Text>
            <ProductGrid products={products.data ?? []} />
          </>
        )}
      </View>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink, paddingHorizontal: gutter, paddingTop: 8 },
  filterLabel: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.mute, paddingHorizontal: gutter, marginTop: 20, marginBottom: 8 },
  chips: { gap: 8, paddingHorizontal: gutter },
  results: { paddingHorizontal: gutter, marginTop: 24, gap: 16 },
  count: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
})
