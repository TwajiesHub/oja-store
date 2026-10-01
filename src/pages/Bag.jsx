import { useEffect, useState } from 'react'

import BagLine from '../components/BagLine.jsx'
import BrandChip from '../components/BrandChip.jsx'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import useBag from '../hooks/useBag.js'
import useBagQuote from '../hooks/useBagQuote.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatNaira } from '../lib/money.js'

function groupByBrand(lines) {
  const groups = new Map()
  for (const line of lines) {
    if (!groups.has(line.brand.slug)) groups.set(line.brand.slug, { brand: line.brand, lines: [] })
    groups.get(line.brand.slug).lines.push(line)
  }
  return [...groups.values()]
}

function deliveryHint(remainingKobo) {
  if (remainingKobo === 0) return 'You have unlocked free standard delivery in Lagos.'
  return `You're ${formatNaira(remainingKobo)} away from free Lagos delivery.`
}

export default function Bag() {
  usePageTitle('Your bag')
  const { items, setQuantity, remove, acknowledgePrice } = useBag()
  const { quote, error, loading, reload } = useBagQuote(items)
  // What changed since the shopper last looked, by variant id: { reduced: n, price: {from, to} }.
  const [notes, setNotes] = useState({})
  const [droppedSome, setDroppedSome] = useState(false)

  // Bring the saved bag in line with what the server says can be bought.
  useEffect(() => {
    if (!quote) return
    if (quote.removed_variant_ids.length > 0) {
      remove(quote.removed_variant_ids)
      setDroppedSome(true)
    }
    for (const line of quote.lines) {
      const saved = items.find((item) => item.variant_id === line.variant_id)
      if (!saved) continue
      if (line.issue === 'reduced') {
        setNotes((all) => ({ ...all, [line.variant_id]: { ...all[line.variant_id], reduced: line.quantity } }))
        setQuantity(line.variant_id, line.quantity)
      }
      if (saved.seen_price_kobo === undefined) {
        acknowledgePrice(line.variant_id, line.unit_price_kobo)
      } else if (saved.seen_price_kobo !== line.unit_price_kobo) {
        const price = { from: saved.seen_price_kobo, to: line.unit_price_kobo }
        setNotes((all) => ({ ...all, [line.variant_id]: { ...all[line.variant_id], price } }))
      }
    }
    // Only a new quote should trigger this; the saved items it reads are the ones it priced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote])

  function acceptPrice(line) {
    acknowledgePrice(line.variant_id, line.unit_price_kobo)
    setNotes((all) => ({ ...all, [line.variant_id]: { ...all[line.variant_id], price: undefined } }))
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your bag is empty."
        text="Start with the brands, or an edit."
        actionTo="/brands"
        actionLabel="See the brands"
        secondaryTo="/edits"
        secondaryLabel="Or see the edits"
      />
    )
  }
  if (!quote && error) return <ErrorState page onRetry={reload} />
  if (!quote) return <Loading count={2} />

  const groups = groupByBrand(quote.lines)
  const hasSoldOut = quote.lines.some((line) => line.issue === 'sold_out')
  const canCheckOut = quote.lines.length > 0 && !hasSoldOut

  return (
    <div className="bag-page">
      <h1 className="display bag-page__title">Your bag</h1>
      {droppedSome && (
        <p className="bag-page__notice" role="status">Something in your bag is no longer sold, so we removed it.</p>
      )}
      {error && <ErrorState onRetry={reload} />}

      {quote.lines.length === 0 ? (
        <EmptyState
          text="Start with the brands, or an edit."
          actionTo="/brands"
          actionLabel="See the brands"
          secondaryTo="/edits"
          secondaryLabel="Or see the edits"
        />
      ) : (
        <div className="bag-page__layout">
          <div className="bag-groups">
            {groups.map(({ brand, lines }) => (
              <section key={brand.slug} className="bag-group" aria-label={brand.name}>
                <BrandChip brand={brand} />
                <ul className="bag-group__lines">
                  {lines.map((line) => (
                    <BagLine
                      key={line.variant_id}
                      line={line}
                      notes={notes[line.variant_id]}
                      onQuantity={(l, value) => setQuantity(l.variant_id, value)}
                      onRemove={(l) => remove([l.variant_id])}
                      onAcceptPrice={acceptPrice}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <aside className="bag-summary" aria-busy={loading}>
            <div className="bag-summary__head">
              <h2 className="bag-summary__title">Summary</h2>
              <span className="label">
                {quote.item_count} {quote.item_count === 1 ? 'item' : 'items'} · {groups.length}{' '}
                {groups.length === 1 ? 'brand' : 'brands'}
              </span>
            </div>
            <dl className="bag-summary__rows">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatNaira(quote.subtotal_kobo)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>At checkout</dd>
              </div>
            </dl>
            <p className="bag-summary__hint">{deliveryHint(quote.free_delivery_remaining_kobo)}</p>
            {canCheckOut ? (
              <Button to="/checkout">CHECKOUT ↗</Button>
            ) : (
              <button type="button" className="button button--primary" disabled>
                CHECKOUT ↗
              </button>
            )}
            {hasSoldOut && <p className="bag-summary__fine">Remove the sold-out items to check out.</p>}
            <p className="bag-summary__fine">
              You will sign in with Google at checkout. Prices and stock are checked again when you pay.
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
