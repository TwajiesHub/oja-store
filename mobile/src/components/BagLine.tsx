import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'

import QuantityStepper from './QuantityStepper'
import { maxQuantityFor } from '@/lib/bagLogic'
import { imageUrl } from '@/lib/images'
import { formatNaira } from '@/lib/money'
import { colors, fonts, minTouch } from '@/lib/theme'
import type { BagLine as Line } from '@/lib/types'

const FLASH_MS = 1500

type Props = { line: Line; flash: boolean; onQuantity: (value: number) => void; onRemove: () => void }

export default function BagLine({ line, flash, onQuantity, onRemove }: Props) {
  // When another device changes this line it briefly lights up, then settles back to paper.
  const glow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!flash) return
    glow.setValue(1)
    Animated.timing(glow, { toValue: 0, duration: FLASH_MS, useNativeDriver: false }).start()
  }, [flash, glow])
  const background = glow.interpolate({ inputRange: [0, 1], outputRange: [colors.paper, colors.stoneDark] })

  const uri = imageUrl(line.image_url)
  const soldOut = line.issue === 'sold_out'
  return (
    <Animated.View style={[styles.line, { backgroundColor: background }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${line.product_name}, ${line.variant_label}`}
        onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: line.product_slug } })}
        style={styles.thumb}
      >
        {uri ? <Image source={{ uri }} style={styles.image} contentFit="cover" accessibilityLabel={line.product_name} /> : null}
      </Pressable>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {line.product_name}
        </Text>
        <Text style={styles.mute}>
          {line.variant_label} · {formatNaira(line.unit_price_kobo)}
        </Text>
        {soldOut ? (
          <Text style={styles.warn}>Sold out. Remove it to check out.</Text>
        ) : (
          <>
            {line.issue === 'reduced' ? <Text style={styles.warn}>Only {line.quantity} left.</Text> : null}
            <View style={styles.controls}>
              <QuantityStepper value={line.quantity} max={maxQuantityFor(line)} onChange={onQuantity} />
              <Text style={styles.total}>{formatNaira(line.line_total_kobo)}</Text>
            </View>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${line.product_name}, ${line.variant_label}`}
          onPress={onRemove}
          style={styles.remove}
        >
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  thumb: { width: 88, aspectRatio: 4 / 5, backgroundColor: colors.stone },
  image: { width: '100%', height: '100%' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 19, color: colors.ink },
  mute: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
  warn: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  total: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.ink },
  remove: { minHeight: minTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  removeText: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.mute, textDecorationLine: 'underline' },
})
