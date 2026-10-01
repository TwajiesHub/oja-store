import { Link } from 'react-router-dom'

import { formatNaira } from '../lib/money.js'
import QuantityStepper from './QuantityStepper.jsx'

const MAX_QUANTITY = 10

// One line in the bag. Everything shown comes from the server's quote; `notes` explains
// anything that changed since the shopper last looked.
export default function BagLine({ line, notes, onQuantity, onRemove, onAcceptPrice }) {
  const soldOut = line.issue === 'sold_out'
  const url = `/products/${line.product_slug}`

  return (
    <li className="bag-line">
      <Link to={url} className="bag-line__thumb" aria-hidden="true" tabIndex={-1} />
      <div className="bag-line__body">
        <Link to={url} className="bag-line__name">{line.product_name}</Link>
        <span className="bag-line__variant">
          {line.variant_label}
          {line.quantity > 1 && ` · ${formatNaira(line.unit_price_kobo)} each`}
        </span>

        {soldOut && <p className="bag-line__note bag-line__note--problem">Sold out. Remove it to check out.</p>}
        {notes?.reduced && (
          <p className="bag-line__note">Only {notes.reduced} left, so we set the quantity to {notes.reduced}.</p>
        )}
        {notes?.price && (
          <p className="bag-line__note">
            Price changed from {formatNaira(notes.price.from)} to {formatNaira(notes.price.to)}.{' '}
            <button type="button" className="bag-line__ok label text-link" onClick={() => onAcceptPrice(line)}>
              OK
            </button>
          </p>
        )}

        <div className="bag-line__controls">
          {!soldOut && (
            <QuantityStepper
              value={line.quantity}
              max={Math.min(line.stock, MAX_QUANTITY)}
              onChange={(value) => onQuantity(line, value)}
            />
          )}
          <button type="button" className="bag-line__remove label text-link" onClick={() => onRemove(line)}>
            Remove
          </button>
        </div>
      </div>
      <span className="bag-line__total">{soldOut ? '—' : formatNaira(line.line_total_kobo)}</span>
    </li>
  )
}
