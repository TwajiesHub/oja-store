import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'

import { isLightKit, kitFor, kitText } from '@/lib/brandKit'
import { colors, fonts } from '@/lib/theme'
import type { Brand } from '@/lib/types'

// A brand's block: its colours, its name in its own type, and what it makes.
export default function BrandTile({ brand }: { brand: Brand }) {
  const kit = kitFor(brand.type_pairing)
  return (
    <Link href={{ pathname: '/brand/[slug]', params: { slug: brand.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${brand.name}, ${brand.descriptor}`}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: brand.accent },
          isLightKit(brand) && styles.outlined,
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[kitText(brand.type_pairing, 34 * (kit.heroScale < 1 ? 0.8 : 1)), { color: brand.accent_text, includeFontPadding: false }]}
        >
          {brand.name}
        </Text>
        <Text style={[styles.label, { color: brand.accent_text }]}>{brand.descriptor}</Text>
      </Pressable>
    </Link>
  )
}

const styles = StyleSheet.create({
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 112, justifyContent: 'space-between', padding: 14 },
  outlined: { borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
})
