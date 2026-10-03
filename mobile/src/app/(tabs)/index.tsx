import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import BrandTile from '@/components/BrandTile'
import Button from '@/components/Button'
import ProductGrid from '@/components/ProductGrid'
import { ErrorState, Loading } from '@/components/States'
import { imageUrl } from '@/lib/images'
import { colors, fonts, gutter } from '@/lib/theme'
import type { Brand, EditSummary, ProductCardData } from '@/lib/types'
import { useApi } from '@/lib/useApi'

const NEW_IN_COUNT = 4

// One featured product from each of the first few brands, so "New in" shows variety.
function pickArrivals(featured: ProductCardData[]): ProductCardData[] {
  const seen = new Set<string>()
  const picks: ProductCardData[] = []
  for (const product of featured) {
    if (!seen.has(product.brand.slug)) {
      seen.add(product.brand.slug)
      picks.push(product)
    }
  }
  return picks.slice(0, NEW_IN_COUNT)
}

function EditTile({ edit, number }: { edit: EditSummary; number: number }) {
  return (
    // The press handler is on the Pressable itself: a Link asChild drops a function style, which is
    // what left these tiles with no background.
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${edit.title}, ${edit.piece_count} pieces`}
      onPress={() => router.push({ pathname: '/edit/[slug]', params: { slug: edit.slug } })}
      style={({ pressed }) => [styles.edit, { backgroundColor: edit.accent }, pressed && { opacity: 0.85 }]}
    >
      <Text style={[styles.editLabel, { color: edit.accent_text }]}>
        N° {String(number).padStart(2, '0')} · {edit.kicker}
      </Text>
      <Text style={[styles.editTitle, { color: edit.accent_text }]}>{edit.title}</Text>
      <Text style={[styles.editLabel, { color: edit.accent_text }]}>{edit.piece_count} pieces ↗</Text>
    </Pressable>
  )
}

function SectionHead({ children, link }: { children: React.ReactNode; link?: { label: string; href: '/shop' } }) {
  return (
    <View style={styles.sectionHead}>
      <Text accessibilityRole="header" style={styles.h2}>
        {children}
      </Text>
      {link ? (
        // The text sits on the heading's baseline; the hit slop around it is the 48dp touch area.
        <Pressable
          accessibilityRole="link"
          hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
          onPress={() => router.push(link.href)}
        >
          <Text style={styles.link}>{link.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export default function Shop() {
  const brands = useApi<Brand[]>('/brands')
  const edits = useApi<EditSummary[]>('/edits')
  const featured = useApi<ProductCardData[]>('/products?featured=true')
  const requests = [brands, edits, featured]
  const failed = requests.find((request) => request.error)
  const loading = requests.some((request) => request.loading)
  const reloadAll = () => requests.forEach((request) => request.reload())

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reloadAll} tintColor={colors.ink} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>A market for made-in-Nigeria · Lagos</Text>
          <Text accessibilityRole="header" style={styles.headline}>
            The best of made‑in‑Nigeria, <Text style={styles.editorial}>in one market.</Text>
          </Text>
          <Text style={styles.intro}>Six independent brands, one bag and one checkout.</Text>
          <Button label="SHOP ALL ↗" onPress={() => router.push('/shop')} />
          <View style={styles.cover}>
            <Text style={styles.coverLabel}>Cover story</Text>
            <Image
              source={{ uri: imageUrl('/images/products/cover-story.webp') ?? undefined }}
              style={styles.coverImage}
              contentFit="cover"
              accessibilityLabel="A woman in an indigo adire wrap dress, a coral bead necklace and a tooled tan leather clutch, walking down a busy market street under bright umbrellas in late-afternoon light."
            />
            <Text style={styles.coverCaption}>Wearing Elú, Ivie and Kofa</Text>
          </View>
        </View>

        {failed ? (
          <ErrorState onRetry={reloadAll} />
        ) : loading ? (
          <Loading />
        ) : (
          <>
            <View style={styles.section}>
              <SectionHead>
                Six brands. <Text style={styles.editorial}>One bag.</Text>
              </SectionHead>
              <View style={styles.tiles}>
                {(brands.data ?? []).map((brand) => (
                  <BrandTile key={brand.slug} brand={brand} />
                ))}
              </View>
            </View>

            {(edits.data ?? []).length > 0 ? (
              <View style={styles.section}>
                <SectionHead>The edits</SectionHead>
                <View style={styles.edits}>
                  {(edits.data ?? []).map((edit, index) => (
                    <EditTile key={edit.slug} edit={edit} number={index + 1} />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionHead link={{ label: 'Shop all', href: '/shop' }}>New in</SectionHead>
              <ProductGrid products={pickArrivals(featured.data ?? [])} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 40 },
  hero: { paddingHorizontal: gutter, paddingTop: 24, gap: 16 },
  eyebrow: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.mute },
  headline: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: colors.ink },
  editorial: { fontFamily: fonts.accent },
  intro: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  cover: { gap: 8, marginTop: 8 },
  coverLabel: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.mute },
  coverImage: { width: '100%', aspectRatio: 928 / 1152, backgroundColor: colors.stoneDark },
  coverCaption: { fontFamily: fonts.accent, fontSize: 18, color: colors.ink },
  section: { paddingHorizontal: gutter, paddingTop: 32, marginTop: 32, gap: 16, borderTopWidth: 1, borderTopColor: colors.line },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  h2: { flexShrink: 1, fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  link: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  edits: { gap: 12 },
  edit: { minHeight: 140, padding: 16, justifyContent: 'space-between', gap: 12 },
  editTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
  editLabel: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
})
