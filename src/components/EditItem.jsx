import { Link } from 'react-router-dom'

import { formatNaira } from '../lib/money.js'
import { editItemTitle, variantSummary } from '../lib/variants.js'
import BrandChip from './BrandChip.jsx'
import Placeholder from './Placeholder.jsx'
import VariantPicker from './VariantPicker.jsx'

// One numbered piece in an edit: the picture, the curator's note and an add button.
// Items sold in sizes show a size picker, and can't be added until a size is chosen.
export default function EditItem({ item, chosenId, onChoose, justAdded, onAdd }) {
  const { product, default_variant: defaultVariant } = item
  const chosen = item.needs_size ? item.variants.find((v) => v.id === chosenId) : defaultVariant
  const price = (chosen || defaultVariant).price_kobo
  const soldOut = !item.available
  const title = editItemTitle(product, defaultVariant)

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
          <span className="edit-item__price">{formatNaira(price)}</span>
          <span>{product.category.name} · {variantSummary(product.variant_labels)}</span>
        </div>
        {item.needs_size && (
          <VariantPicker
            variants={item.variants}
            selectedId={chosenId}
            onSelect={(id) => onChoose(item, id)}
            legend="Choose size"
            compact
          />
        )}
        <div className="edit-item__actions">
          <button type="button" className="edit-item__add" disabled={soldOut || !chosen} onClick={() => onAdd(item, chosen)}>
            {soldOut ? 'SOLD OUT' : justAdded ? 'ADDED TO BAG ✓' : 'ADD TO BAG'}
          </button>
          <Link to={`/products/${product.slug}`} className="label text-link">View product</Link>
        </div>
      </div>
    </article>
  )
}
