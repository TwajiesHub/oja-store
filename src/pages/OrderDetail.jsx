import { Link, useParams } from 'react-router-dom'

import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import SignInPrompt from '../components/SignInPrompt.jsx'
import useApi from '../hooks/useApi.js'
import useAuth from '../hooks/useAuth.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatArrival, formatPaidDay } from '../lib/dates.js'
import { formatNaira } from '../lib/money.js'
import { formatPhone } from '../lib/nigeria.js'
import { CONTACT_EMAIL } from '../lib/site.js'
import NotFound from './NotFound.jsx'

function groupByBrand(items) {
  const groups = new Map()
  for (const item of items) {
    if (!groups.has(item.brand_name)) groups.set(item.brand_name, [])
    groups.get(item.brand_name).push(item)
  }
  return [...groups.entries()]
}

export default function OrderDetail() {
  const { number } = useParams()
  usePageTitle(number)
  const { user, loading: authLoading } = useAuth()
  const { data: order, error, loading, reload } = useApi(`/orders/${number}`, { auth: true, skip: !user })

  if (authLoading) return <Loading count={1} />
  if (!user) {
    return <SignInPrompt title="Sign in to see this order." text="Orders belong to the account that paid for them." returnPath={`/orders/${number}`} />
  }
  if (error?.status === 404 || error?.status === 403) return <NotFound />
  if (error) return <ErrorState onRetry={reload} />
  if (loading || !order) return <Loading count={1} />

  const paid = order.status === 'paid'
  const speed = order.delivery_speed === 'express' ? 'Express' : 'Standard'

  return (
    <div className="order-detail">
      <Link to="/orders" className="label text-link order-detail__back">← Your orders</Link>
      <span className="label order-detail__label">
        {paid ? `Paid ${formatPaidDay(order.paid_at)}` : 'Not paid'}
      </span>
      <h1 className="display order-detail__title">Order {order.number}</h1>

      {paid && order.arriving_from && (
        <div className="order-detail__box">
          <span className="label">Arriving</span>
          <strong>{formatArrival(order.arriving_from, order.arriving_to)}</strong>
          <span>{speed} delivery to {order.area}, {order.state}</span>
        </div>
      )}
      {!paid && (
        <div className="order-detail__box">
          This order was started but not paid, so nothing was charged.{' '}
          <Link to="/bag" className="text-link">Back to your bag</Link>
        </div>
      )}

      <section className="order-detail__section">
        <h2>What you ordered</h2>
        {groupByBrand(order.items).map(([brand, items]) => (
          <div key={brand} className="order-detail__group">
            <span className="label">{brand}</span>
            <ul>
              {items.map((item, index) => (
                <li key={index}>
                  <span>
                    {item.product_name}
                    {/^One /.test(item.variant_label) ? '' : ` · ${item.variant_label}`} · × {item.quantity}
                  </span>
                  <span className="order-detail__price">{formatNaira(item.line_total_kobo)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <dl className="order-detail__totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatNaira(order.subtotal_kobo)}</dd>
          </div>
          <div>
            <dt>Delivery · {speed}</dt>
            <dd>{order.delivery_kobo === 0 ? 'Free' : formatNaira(order.delivery_kobo)}</dd>
          </div>
          <div className="order-detail__total">
            <dt>{paid ? 'Total paid (Paystack)' : 'Total'}</dt>
            <dd>{formatNaira(order.total_kobo)}</dd>
          </div>
        </dl>
      </section>

      <section className="order-detail__section">
        <h2>Delivering to</h2>
        <p className="order-detail__address">
          {order.full_name}
          <br />
          {order.address}
          <br />
          {order.area}, {order.state}
          <br />
          {formatPhone(order.phone)}
        </p>
      </section>

      {paid && (
        <p className="order-detail__receipt">
          {order.receipt_sent
            ? `A receipt was sent to ${order.email}.`
            : 'We have not been able to send your receipt email yet. Your order is saved here.'}
        </p>
      )}
      <p className="order-detail__help">
        Need help? {CONTACT_EMAIL ? <>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></> : 'Contact the shop'} with your order number.
      </p>
    </div>
  )
}
