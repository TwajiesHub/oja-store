import { Image } from 'expo-image'
import { useState } from 'react'
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import BrandChip from './BrandChip'
import { LARGE_RATIO, largeImageUrl } from '@/lib/images'
import { colors, fonts } from '@/lib/theme'
import type { ProductDetail } from '@/lib/types'

// Swipeable product photos, full width. With no photo: the stone placeholder.
export default function Gallery({ product }: { product: ProductDetail }) {
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const height = width / LARGE_RATIO
  const uris = product.image_urls.map((path) => largeImageUrl(path)).filter((uri): uri is string => uri !== null)

  if (uris.length === 0) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Text style={styles.placeholderName}>{product.name}</Text>
        <BrandChip brand={product.brand} style={styles.chip} />
      </View>
    )
  }

  return (
    <View>
      <FlatList
        data={uris}
        keyExtractor={(uri) => uri}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: position }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height, backgroundColor: colors.stone }}
            contentFit="cover"
            accessibilityLabel={`${product.image_alt || product.name}, photo ${position + 1} of ${uris.length}`}
          />
        )}
      />
      <BrandChip brand={product.brand} style={styles.chip} />
      {uris.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Photo ${index + 1} of ${uris.length}`}>
          {uris.map((uri, position) => (
            <View key={uri} style={[styles.dot, position === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.stone, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholderName: { fontFamily: fonts.mono, fontSize: 13, color: colors.mute, textAlign: 'center' },
  chip: { position: 'absolute', top: 12, left: 12 },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.paper, opacity: 0.55 },
  dotOn: { opacity: 1, backgroundColor: colors.ink },
})
