import { formatNaira } from '../lib/money.js'
import BrandChip from './BrandChip.jsx'

function groupByBrand(lines) {
  const groups = new Map()
  for (const line of lines) {
    if (!groups.has(line.brand.slug)) groups.set(line.brand.slug, { brand: line.brand, lines: [] })
    groups.get(line.brand.slug).lines.push(line)
  }
  return [...groups.values()]
}

function deliveryText(deliveryKobo) {
  if (deliveryKobo === null) return 'Choose a state'
  return deliveryKobo === 0 ? 'Free' : formatNaira(deliveryKobo)
}

// The stone panel beside the form: the bag by brand, then subtotal, delivery and total.
// Every number is the server's. `deliveryKobo` is null until a delivery speed is priced.
export default function CheckoutSummary({ bag, deliveryKobo, totalKobo, hint }) {
  const groups = groupByBrand(bag.lines)
  return (
    <aside className="checkout-summary" aria-label="Your bag">
      <div className="checkout-summary__head">
        <h2>Your bag</h2>
        <span className="label">
          {bag.item_count} {bag.item_count === 1 ? 'item' : 'items'} · {groups.length} {groups.length === 1 ? 'brand' : 'brands'}
        </span>
      </div>

      {groups.map(({ brand, lines }) => (
        <section key={brand.slug} className="checkout-summary__group">
          <BrandChip brand={brand} />
          <ul>
            {lines.map((line) => (
              <li key={line.variant_id} className="checkout-summary__line">
                <span className="checkout-summary__thumb" aria-hidden="true">
                  {line.image_url && <img src={line.image_url} alt="" width="64" height="79" loading="lazy" decoding="async" />}
                </span>
                <span className="checkout-summary__what">
                  <strong>{line.product_name}</strong>
                  <span>{line.variant_label} · Qty {line.quantity}</span>
                </span>
                <span className="checkout-summary__price">{formatNaira(line.line_total_kobo)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <dl className="checkout-summary__totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatNaira(bag.subtotal_kobo)}</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>{deliveryText(deliveryKobo)}</dd>
        </div>
      </dl>
      <div className="checkout-summary__total">
        <span>Total</span>
        <span className="checkout-summary__total-price">{totalKobo === null ? formatNaira(bag.subtotal_kobo) : formatNaira(totalKobo)}</span>
      </div>
      <p className="checkout-summary__note">{hint} Prices and stock are checked again when you pay.</p>
    </aside>
  )
}
