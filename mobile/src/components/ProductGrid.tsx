import { StyleSheet, View } from 'react-native'

import ProductCard from './ProductCard'
import { gap } from '@/lib/theme'
import type { ProductCardData } from '@/lib/types'

// Two cards per row. Plain rows rather than a list, so it can sit inside a scrolling screen.
export default function ProductGrid({ products }: { products: ProductCardData[] }) {
  const rows: ProductCardData[][] = []
  for (let i = 0; i < products.length; i += 2) rows.push(products.slice(i, i + 2))
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].slug} style={styles.row}>
          {row.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
          {row.length === 1 ? <View style={styles.filler} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { gap: 20 },
  row: { flexDirection: 'row', gap },
  filler: { flex: 1 },
})
