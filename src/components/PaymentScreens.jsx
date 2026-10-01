import { Link } from 'react-router-dom'

import { formatArrival } from '../lib/dates.js'
import { formatNaira } from '../lib/money.js'
import { CONTACT_EMAIL } from '../lib/site.js'
import Button from './Button.jsx'

function Mark({ kind }) {
  if (kind === 'paid') {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="Payment received">
        <circle cx="28" cy="28" r="27" fill="#1F6F6B" />
        <path d="M16 29 L24 37 L41 19" fill="none" stroke="#F1F5EF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'failed') {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="Payment not completed">
        <circle cx="28" cy="28" r="27" fill="#9E2B2B" />
        <path d="M20 20 L36 36 M36 20 L20 36" stroke="#F8ECE8" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className="spinner" width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="Waiting for confirmation">
      <circle cx="28" cy="28" r="24" fill="none" stroke="#CFC8BB" strokeWidth="5" />
      <path d="M28 4 A24 24 0 0 1 52 28" fill="none" stroke="#121110" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function Screen({ kind, label, children, actions }) {
  return (
    <div className="result">
      <Mark kind={kind} />
      <span className="result__label label">{label}</span>
      {children}
      <div className="result__actions">{actions}</div>
    </div>
  )
}

export function ConfirmingScreen({ orderNumber, slow, onCheckAgain }) {
  return (
    <Screen
      kind="confirming"
      label={orderNumber ? `Order ${orderNumber} · Awaiting payment` : 'Awaiting payment'}
      actions={<Button variant="outline" onClick={onCheckAgain}>Check again</Button>}
    >
      <h1 className="display result__title">Confirming your <span className="editorial">payment…</span></h1>
      <p className="result__text" role="status">
        We're waiting for Paystack to confirm. This usually takes a few seconds, and this page updates by itself.
      </p>
      <div className="result__box">
        If it takes longer, it's safe to close this page. Your order is saved.
      </div>
      {slow && (
        <div className="result__box result__box--warn" role="alert">
          {CONTACT_EMAIL ? (
            <>
              If you were charged and this doesn't update, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your order number {orderNumber}.
            </>
          ) : (
            <>If you were charged and this doesn't update, contact the shop with your order number {orderNumber}.</>
          )}
        </div>
      )}
    </Screen>
  )
}

function itemLine(item) {
  const name = /^One /.test(item.variant_label) ? item.product_name : `${item.product_name}, ${item.variant_label}`
  return `${item.brand_name} · ${name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
}

export function PaidScreen({ order }) {
  const firstName = order.full_name.trim().split(/\s+/)[0]
  const speed = order.delivery_speed === 'express' ? 'Express' : 'Standard'
  return (
    <Screen
      kind="paid"
      label={`Order ${order.number} · Paid`}
      actions={
        <>
          <Button to="/orders">View your orders</Button>
          <Button to="/" variant="outline">Keep shopping</Button>
        </>
      }
    >
      <h1 className="display result__title">Payment received. <span className="editorial">Thank you, {firstName}.</span></h1>
      <p className="result__text">
        {order.receipt_sent
          ? `Your receipt is on its way to ${order.email}. Check spam if it isn't in your inbox within a few minutes.`
          : 'Your order is confirmed and saved. We have not been able to send your receipt email yet; you can always find the order under Your orders.'}
      </p>
      {order.arriving_from && (
        <div className="result__box result__box--arriving">
          <span className="label">Arriving</span>
          <strong>{formatArrival(order.arriving_from, order.arriving_to)}</strong>
          <span>{speed} delivery to {order.area}, {order.state}</span>
        </div>
      )}
      <ul className="result__items">
        {order.items.map((item, index) => (
          <li key={index}>
            <span>{itemLine(item)}</span>
            <span className="result__price">{formatNaira(item.line_total_kobo)}</span>
          </li>
        ))}
        <li>
          <span>Delivery</span>
          <span className="result__price">{order.delivery_kobo === 0 ? 'Free' : formatNaira(order.delivery_kobo)}</span>
        </li>
        <li className="result__total">
          <span>Paid with Paystack</span>
          <span className="result__price">{formatNaira(order.total_kobo)}</span>
        </li>
      </ul>
    </Screen>
  )
}

export function FailedScreen({ orderNumber, onTryAgain, trying, problem }) {
  return (
    <Screen
      kind="failed"
      label={`Order ${orderNumber} · Not paid`}
      actions={
        <>
          <Button onClick={onTryAgain} disabled={trying}>{trying ? 'Taking you to Paystack…' : 'Try payment again'}</Button>
          <Button to="/bag" variant="outline">Back to your bag</Button>
        </>
      }
    >
      <h1 className="display result__title">Payment didn't <span className="editorial">go through.</span></h1>
      <p className="result__text">
        No money was taken. Your bag is saved, so you can try again, or pick a different method on Paystack, such as
        bank transfer or USSD.
      </p>
      {problem && <div className="result__box result__box--warn" role="alert">{problem}</div>}
      <div className="result__box">
        Cards from some Nigerian banks need online payments switched on in the bank's app first.
      </div>
    </Screen>
  )
}

export function MissingScreen() {
  return (
    <Screen
      kind="failed"
      label="Payment not found"
      actions={<Button to="/bag">Back to your bag</Button>}
    >
      <h1 className="display result__title">We couldn't find <span className="editorial">that payment.</span></h1>
      <p className="result__text">
        The link may be wrong, or it may belong to another account. If you were charged, see{' '}
        <Link to="/terms" className="text-link">our terms</Link> for how to reach us.
      </p>
    </Screen>
  )
}
