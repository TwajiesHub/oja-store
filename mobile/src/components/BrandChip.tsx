import { StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { kitText } from '@/lib/brandKit'
import type { BrandKitData } from '@/lib/types'

// The brand's name in its own colours and type: the one place brand colour appears on a product.
export default function BrandChip({ brand, style }: { brand: BrandKitData; style?: ViewStyle }) {
  return (
    <View style={[styles.chip, { backgroundColor: brand.accent }, style]}>
      <Text
        numberOfLines={1}
        style={[kitText(brand.type_pairing, 14, 'chip'), { color: brand.accent_text, includeFontPadding: false }]}
      >
        {brand.name}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5 },
})
