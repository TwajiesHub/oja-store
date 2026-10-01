import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import BrandChip from '../components/BrandChip.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import Placeholder from '../components/Placeholder.jsx'
import ProductCard from '../components/ProductCard.jsx'
import QuantityStepper from '../components/QuantityStepper.jsx'
import VariantPicker from '../components/VariantPicker.jsx'
import useApi from '../hooks/useApi.js'
import useBag from '../hooks/useBag.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { kitStyle } from '../lib/brandKit.js'
import { formatNaira } from '../lib/money.js'
import NotFound from './NotFound.jsx'

const MAX_QUANTITY = 10
const ADDED_FEEDBACK_MS = 2000
const LOW_STOCK_LIMIT = 5
const MORE_FROM_BRAND_COUNT = 4

function stockLine(variant) {
  const status = variant.stock === 0 ? 'Sold out' : variant.stock <= LOW_STOCK_LIMIT ? `Only ${variant.stock} left` : 'In stock'
  return `${status} · Delivered in 1–3 days in Lagos · Pay with Paystack`
}

function ProductInfo({ product }) {
  const firstInStock = product.variants.find((v) => v.stock > 0) || product.variants[0]
  const [variantId, setVariantId] = useState(firstInStock.id)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [note, setNote] = useState('')
  const { add } = useBag()

  const variant = product.variants.find((v) => v.id === variantId)
  const maxQuantity = Math.min(variant.stock, MAX_QUANTITY)
  const soldOut = variant.stock === 0

  useEffect(() => {
    if (!added) return undefined
    const timer = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [added])

  function pickVariant(id) {
    const next = product.variants.find((v) => v.id === id)
    setVariantId(id)
    setQuantity((q) => Math.min(q, Math.max(Math.min(next.stock, MAX_QUANTITY), 1)))
    setAdded(false)
    setNote('')
  }

  function changeQuantity(value) {
    setQuantity(Math.min(Math.max(value, 1), maxQuantity))
    setAdded(false)
    setNote('')
  }

  function addToBag() {
    const addedCount = add(variant.id, quantity, variant.stock)
    setAdded(addedCount > 0)
    if (addedCount === 0) setNote('Your bag already has the most you can buy of this.')
    else if (addedCount < quantity) setNote(`Added ${addedCount}. That is the most you can buy of this.`)
    else setNote('')
  }

  const addLabel = soldOut
    ? 'SOLD OUT'
    : added
      ? 'ADDED TO BAG ✓'
      : `ADD TO BAG · ${formatNaira(variant.price_kobo * quantity)}`

  return (
    <div className="product-info">
      <div className="product-info__heading">
        <Link to={`/brands/${product.brand.slug}`} className="product-info__by label">
          By {product.brand.name} · {product.brand_full.descriptor} ↗
        </Link>
        <h1 className="display product-info__name">{product.name}</h1>
        <span className="product-info__price">{formatNaira(variant.price_kobo)}</span>
      </div>

      <VariantPicker variants={product.variants} selectedId={variantId} onSelect={pickVariant} />

      <div className="product-info__buy">
        {!soldOut && <QuantityStepper value={quantity} max={maxQuantity} onChange={changeQuantity} />}
        <button type="button" className="product-info__add" disabled={soldOut} onClick={addToBag}>
          {addLabel}
        </button>
      </div>
      <p className="product-info__stock">{stockLine(variant)}</p>
      <p className="product-info__note" role="status">{note}</p>

      <details className="accordion" open>
        <summary>Details</summary>
        <p>{product.description}</p>
        {product.details && <p>{product.details}</p>}
      </details>
      <details className="accordion">
        <summary>Delivery and returns</summary>
        <p>
          Lagos: standard in 1–3 days, free over ₦50,000 and ₦2,500 below that. Express is ₦5,000 and arrives the
          same day if you order by 12:00 WAT.
        </p>
        <p>
          Other states: 3–5 days for ₦4,500. Return unused items within 7 days.
        </p>
      </details>
    </div>
  )
}

function MoreFromBrand({ brand, currentSlug }) {
  const { data } = useApi(`/products?brand=${brand.slug}`)
  const more = (data || []).filter((p) => p.slug !== currentSlug).slice(0, MORE_FROM_BRAND_COUNT)
  if (more.length === 0) return null

  return (
    <section className="product-page__more">
      <div className="product-page__more-head">
        <h2 className="display">More from {brand.name}</h2>
        <Link to={`/brands/${brand.slug}`} className="label text-link">All</Link>
      </div>
      <div className="product-grid product-grid--four">
        {more.map((p) => <ProductCard key={p.slug} product={p} showBrand={false} />)}
      </div>
    </section>
  )
}

export default function Product() {
  const { slug } = useParams()
  const product = useApi(`/products/${slug}`)
  usePageTitle(product.data?.name)

  if (product.error?.status === 404) return <NotFound />
  if (product.error) return <ErrorState onRetry={product.reload} />
  if (!product.data) return <Loading count={1} />

  const data = product.data

  return (
    <div className="product-page">
      <div className="product-page__image">
        <Placeholder brand={data.brand} name={data.name} showBrand={false} />
        <Link to={`/brands/${data.brand.slug}`} className="product-page__chip" aria-label={`${data.brand.name} brand page`}>
          <BrandChip brand={data.brand} />
        </Link>
      </div>

      {/* key restarts the picker's state when you move to another product */}
      <ProductInfo key={data.slug} product={data} />

      {data.edits.length > 0 && (
        <section className="product-page__edits">
          <span className="label">In the edits</span>
          {data.edits.map((edit) => (
            <Link key={edit.slug} to={`/edits/${edit.slug}`} className="edit-link" style={kitStyle(edit)}>
              <span className="editorial">{edit.title}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </section>
      )}

      <MoreFromBrand brand={data.brand} currentSlug={data.slug} />
    </div>
  )
}
