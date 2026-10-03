// The shapes the API returns (see api/schemas.py). Money is always integer kobo.
export type BrandKitData = {
  slug: string
  name: string
  accent: string
  accent_text: string
  type_pairing: string
}

export type Brand = BrandKitData & {
  id: number
  tagline: string
  descriptor: string
  slogan: string
  story: string
  city: string
  hero_image_url: string | null
}

export type Category = { id: number; slug: string; name: string }

export type Variant = { id: number; label: string; price_kobo: number; stock: number }

export type ProductCardData = {
  id: number
  slug: string
  name: string
  brand: BrandKitData
  category: Category
  from_price_kobo: number
  price_varies: boolean
  image_url: string | null
  image_alt: string
  in_stock: boolean
  variant_labels: string[]
  created_at: string
}

export type EditSummary = {
  id: number
  slug: string
  title: string
  kicker: string
  intro: string
  accent: string
  accent_text: string
  piece_count: number
}

export type EditTag = { slug: string; title: string; accent: string; accent_text: string }

export type ProductDetail = ProductCardData & {
  needs_size: boolean
  description: string
  details: string
  image_urls: string[]
  variants: Variant[]
  brand_full: Brand
  edits: EditTag[]
}

export type BrandDetail = Brand & { products: ProductCardData[]; edits: EditTag[] }

export type EditItem = {
  position: number
  note: string
  product: ProductCardData
  default_variant: Variant
  variants: Variant[]
  needs_size: boolean
  available: boolean
}

export type EditDetail = EditSummary & { items: EditItem[]; available_count: number; total_kobo: number }

export type BagLine = {
  variant_id: number
  product_slug: string
  product_name: string
  variant_label: string
  brand: BrandKitData
  unit_price_kobo: number
  stock: number
  image_url: string | null
  requested_quantity: number
  quantity: number
  line_total_kobo: number
  issue: 'sold_out' | 'reduced' | null
}

export type BagQuote = {
  lines: BagLine[]
  removed_variant_ids: number[]
  item_count: number
  subtotal_kobo: number
  free_delivery_remaining_kobo: number
}
