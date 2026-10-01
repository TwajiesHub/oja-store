import { Link } from 'react-router-dom'

import { formatNaira } from '../lib/money.js'
import { variantSummary } from '../lib/variants.js'
import Placeholder from './Placeholder.jsx'

export default function ProductCard({ product, showBrand = true }) {
  const price = formatNaira(product.from_price_kobo)
  const meta = [product.category.name, variantSummary(product.variant_labels)]

  return (
    <Link to={`/products/${product.slug}`} className="product-card">
      <div className="product-card__image">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" />
        ) : (
          <Placeholder brand={product.brand} name={product.name} showBrand={showBrand} />
        )}
      </div>
      <div className="product-card__row">
        <span className="product-card__name">{product.name}</span>
        <span className="product-card__price">{product.price_varies ? `from ${price}` : price}</span>
      </div>
      <span className="product-card__meta">
        {meta.join(' · ')}
        {!product.in_stock && <strong className="product-card__sold-out"> · Sold out</strong>}
      </span>
    </Link>
  )
}
