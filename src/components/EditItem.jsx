import { Link } from 'react-router-dom'

import { formatNaira } from '../lib/money.js'
import { editItemTitle, isApparelSize, variantSummary } from '../lib/variants.js'
import BrandChip from './BrandChip.jsx'
import Placeholder from './Placeholder.jsx'

// One numbered piece in an edit: the picture, the curator's note and an add button.
export default function EditItem({ item, justAdded, onAdd }) {
  const { product, default_variant: variant } = item
  const soldOut = variant.stock === 0
  const title = editItemTitle(product, variant)
  const detail = isApparelSize(variant.label) ? `size ${variant.label}` : variantSummary(product.variant_labels)

  return (
    <article className="edit-item">
      <Link to={`/products/${product.slug}`} className="edit-item__image" aria-label={`View ${title}`}>
        <Placeholder brand={product.brand} name={title} showBrand={false} />
      </Link>
      <div className="edit-item__body">
        <span className="edit-item__number label">{String(item.position).padStart(2, '0')}</span>
        <BrandChip brand={product.brand} />
        <h2 className="edit-item__name display">{title}</h2>
        <p className="edit-item__note editorial">“{item.note}”</p>
        <div className="edit-item__meta">
          <span className="edit-item__price">{formatNaira(variant.price_kobo)}</span>
          <span>{product.category.name} · {detail}</span>
        </div>
        <div className="edit-item__actions">
          <button type="button" className="edit-item__add" disabled={soldOut} onClick={() => onAdd(item)}>
            {soldOut ? 'SOLD OUT' : justAdded ? 'ADDED TO BAG ✓' : 'ADD TO BAG'}
          </button>
          <Link to={`/products/${product.slug}`} className="label text-link">View product</Link>
        </div>
      </div>
    </article>
  )
}
