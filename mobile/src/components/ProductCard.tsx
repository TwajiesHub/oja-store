import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import BrandChip from './BrandChip'
import { imageUrl } from '@/lib/images'
import { formatNaira } from '@/lib/money'
import { colors, fonts } from '@/lib/theme'
import type { ProductCardData } from '@/lib/types'
import { variantSummary } from '@/lib/variants'

// A product's photo slot: a fixed 4:5 area, so every card is the same shape whatever its photo.
// Products without a photo get the stone placeholder: brand chip and name.
export function ProductImage({ product }: { product: ProductCardData }) {
  const uri = imageUrl(product.image_url)
  return (
    <View style={styles.image}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          accessibilityLabel={product.image_alt || product.name}
        />
      ) : (
        <View style={styles.placeholder} accessible={false}>
          <Text style={styles.placeholderName} numberOfLines={3}>
            {product.name}
          </Text>
        </View>
      )}
      <BrandChip brand={product.brand} style={styles.chip} />
    </View>
  )
}

export default function ProductCard({ product }: { product: ProductCardData }) {
  const price = `${product.price_varies ? 'from ' : ''}${formatNaira(product.from_price_kobo)}`
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${product.name}, ${product.brand.name}, ${price}${product.in_stock ? '' : ', sold out'}`}
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <ProductImage product={product} />
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.price}>{price}</Text>
      <Text style={styles.mute}>{product.in_stock ? variantSummary(product.variant_labels) : 'Sold out'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Zero basis: every card in a row is exactly the same width.
  card: { flex: 1, flexBasis: 0, minWidth: 0, gap: 4, minHeight: 48 },
  pressed: { opacity: 0.85 },
  image: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.stone, marginBottom: 6, overflow: 'hidden' },
  placeholder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 12 },
  placeholderName: { fontFamily: fonts.mono, fontSize: 11, color: colors.mute, textAlign: 'center' },
  chip: { position: 'absolute', top: 8, left: 8 },
  name: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 18, color: colors.ink },
  price: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
  mute: { fontFamily: fonts.mono, fontSize: 11, color: colors.mute },
})
