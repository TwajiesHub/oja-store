import { Link, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import Button from '@/components/Button'
import Chip from '@/components/Chip'
import Gallery from '@/components/Gallery'
import ProductGrid from '@/components/ProductGrid'
import QuantityStepper from '@/components/QuantityStepper'
import ScreenScroll from '@/components/ScreenScroll'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { ApiError, apiPost } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatNaira } from '@/lib/money'
import { colors, fonts, gutter } from '@/lib/theme'
import type { ProductCardData, ProductDetail } from '@/lib/types'
import { useApi } from '@/lib/useApi'

const MAX_QUANTITY = 10
const LOW_STOCK_LIMIT = 5
const ADDED_FEEDBACK_MS = 2000
const MORE_FROM_BRAND_COUNT = 4
const DELIVERY_AND_PAYMENT = 'Delivered in 1–3 days in Lagos · Pay with Paystack'

function stockLine(variant: ProductDetail['variants'][number] | undefined): string {
  if (!variant) return `Choose a size · ${DELIVERY_AND_PAYMENT}`
  const status = variant.stock === 0 ? 'Sold out' : variant.stock <= LOW_STOCK_LIMIT ? `Only ${variant.stock} left` : 'In stock'
  return `${status} · ${DELIVERY_AND_PAYMENT}`
}

function ProductInfo({ product }: { product: ProductDetail }) {
  const { session } = useAuth()
  // A clothing size is the shopper's choice, so none is preselected. Other options are.
  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0]
  const [variantId, setVariantId] = useState<number | null>(product.needs_size ? null : firstInStock.id)
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  const [note, setNote] = useState('')

  const variant = product.variants.find((v) => v.id === variantId)
  const needsSize = !variant
  const maxQuantity = variant ? Math.min(variant.stock, MAX_QUANTITY) : 1
  const soldOut = variant ? variant.stock === 0 : product.variants.every((v) => v.stock === 0)
  const prices = product.variants.map((v) => v.price_kobo)
  const pricePrefix = !variant && product.price_varies ? 'from ' : ''

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [added])

  function pickVariant(id: number) {
    const next = product.variants.find((v) => v.id === id)
    if (!next) return
    setVariantId(id)
    setQuantity((q) => Math.min(q, Math.max(Math.min(next.stock, MAX_QUANTITY), 1)))
    setAdded(false)
    setNote('')
  }

  async function addToBag() {
    if (!variant) return
    if (!session) {
      setNote('Sign in on the Account tab to add to your bag.')
      return
    }
    setBusy(true)
    setNote('')
    try {
      // The server prices and clamps the add; the app only says which variant and how many.
      await apiPost('/bag/items', { variant_id: variant.id, quantity }, { auth: true })
      setAdded(true)
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) setNote(failure.detail ?? 'Sorry, that item is sold out.')
      else if (failure instanceof ApiError && failure.status === 404) setNote('That item is no longer available.')
      else setNote('Could not add that to your bag. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const addLabel = soldOut
    ? 'SOLD OUT'
    : needsSize
      ? 'CHOOSE A SIZE'
      : added
        ? 'ADDED TO BAG ✓'
        : !session
          ? 'SIGN IN TO ADD'
          : `ADD TO BAG · ${formatNaira(variant.price_kobo * quantity)}`

  return (
    <View style={styles.info}>
      <View style={styles.heading}>
        <Link href={{ pathname: '/brand/[slug]', params: { slug: product.brand.slug } }} asChild>
          <Pressable accessibilityRole="link" style={styles.by}>
            <Text style={styles.label}>
              By {product.brand.name} · {product.brand_full.descriptor} ↗
            </Text>
          </Pressable>
        </Link>
        <Text accessibilityRole="header" style={styles.name}>
          {product.name}
        </Text>
        <Text style={styles.price}>
          {pricePrefix}
          {formatNaira(variant ? variant.price_kobo : Math.min(...prices))}
        </Text>
      </View>

      {product.variants.length > 1 || product.needs_size ? (
        <View style={styles.pickerBlock}>
          <Text style={styles.label}>{product.needs_size ? 'Size' : 'Option'}</Text>
          <View style={styles.variants}>
            {product.variants.map((v) => (
              <Chip key={v.id} label={v.label} selected={v.id === variantId} disabled={v.stock === 0} onPress={() => pickVariant(v.id)} />
            ))}
          </View>
        </View>
      ) : null}

      {!soldOut ? <QuantityStepper value={quantity} max={maxQuantity} onChange={(q) => { setQuantity(q); setAdded(false); setNote('') }} /> : null}
      <Button
        label={addLabel}
        busy={busy}
        onPress={() => (!session && variant && !soldOut ? router.push('/account') : addToBag())}
        variant={soldOut || needsSize ? 'outline' : 'solid'}
      />
      <Text style={styles.stock}>{stockLine(variant)}</Text>
      {note ? (
        <Text accessibilityRole="alert" style={styles.note}>
          {note}
        </Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.label}>Details</Text>
        <Text style={styles.body}>{product.description}</Text>
        {product.details ? <Text style={styles.body}>{product.details}</Text> : null}
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Delivery and returns</Text>
        <Text style={styles.body}>
          Lagos: standard in 1–3 days, free over ₦50,000 and ₦2,500 below that. Express is ₦5,000 and arrives the same day if you
          order by 12:00 WAT.
        </Text>
        <Text style={styles.body}>Other states: 3–5 days for ₦4,500. Return unused items within 7 days.</Text>
      </View>
    </View>
  )
}

function MoreFromBrand({ product }: { product: ProductDetail }) {
  const { data } = useApi<ProductCardData[]>(`/products?brand=${product.brand.slug}`)
  const more = (data ?? []).filter((p) => p.slug !== product.slug).slice(0, MORE_FROM_BRAND_COUNT)
  if (more.length === 0) return null
  return (
    <View style={styles.more}>
      <Text accessibilityRole="header" style={styles.h2}>
        More from {product.brand.name}
      </Text>
      <ProductGrid products={more} />
    </View>
  )
}

export default function ProductPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: product, error, loading, reload } = useApi<ProductDetail>(`/products/${slug}`)

  if (loading) return <Loading />
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState title="We couldn't find that piece" note="It may have sold out of the shop. Try the Shop tab." />
  }
  if (error || !product) return <ErrorState onRetry={reload} />

  return (
    <ScreenScroll onRefresh={reload}>
      <Gallery product={product} />
      <ProductInfo key={product.slug} product={product} />
      <MoreFromBrand product={product} />
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  info: { padding: gutter, gap: 16 },
  heading: { gap: 6 },
  by: { minHeight: 48, justifyContent: 'center' },
  label: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.mute },
  name: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.ink },
  price: { fontFamily: fonts.monoMedium, fontSize: 18, color: colors.ink },
  pickerBlock: { gap: 8 },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stock: { fontFamily: fonts.mono, fontSize: 11, color: colors.mute },
  note: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.error },
  section: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.ink },
  more: { paddingHorizontal: gutter, paddingTop: 16, gap: 16 },
  h2: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
})
