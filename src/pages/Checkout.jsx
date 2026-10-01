import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import Button from '../components/Button.jsx'
import CheckoutSummary from '../components/CheckoutSummary.jsx'
import DeliveryFields from '../components/DeliveryFields.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import useAuth from '../hooks/useAuth.js'
import useBag from '../hooks/useBag.js'
import useBagQuote from '../hooks/useBagQuote.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { apiGet, apiPost } from '../lib/api.js'
import { formatNaira } from '../lib/money.js'
import { validateDelivery } from '../lib/nigeria.js'

const EMPTY_FORM = {
  full_name: '', phone: '', address: '', area: '', state: 'Lagos', delivery_speed: 'standard', save_address: true,
}
const FIELD_ORDER = ['full_name', 'phone', 'address', 'area', 'state']
const GENERIC_PROBLEM = 'Something went wrong. Check your connection and try again.'

function problemFrom(error) {
  if (error.status === 401) return 'Your session has ended. Sign in again to pay.'
  return error.detail || GENERIC_PROBLEM
}

function Step({ number, title, aside, children }) {
  return (
    <section className="step">
      <div className="step__head">
        <span className="step__number" aria-hidden="true">{number}</span>
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export default function Checkout() {
  usePageTitle('Checkout')
  const { user, loading: authLoading, available, signIn, signOut } = useAuth()
  const { items } = useBag()
  const guestQuote = useBagQuote(user ? [] : items)

  const [values, setValues] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteFailed, setQuoteFailed] = useState(false)
  const [quoteTry, setQuoteTry] = useState(0)
  const prefilled = useRef(false)

  // Fill the form from the saved profile, once.
  useEffect(() => {
    if (!user || prefilled.current) return
    prefilled.current = true
    apiGet('/me', { auth: true })
      .then((profile) => setValues((v) => ({
        ...v,
        full_name: profile.full_name || v.full_name,
        phone: profile.phone || v.phone,
        address: profile.address || v.address,
        area: profile.area || v.area,
        state: profile.state || v.state,
      })))
      .catch(() => {})
  }, [user])

  // Delivery and total always come from the server, for the chosen state and speed.
  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    apiPost('/checkout/quote', { state: values.state, delivery_speed: values.delivery_speed }, { auth: true })
      .then((next) => {
        if (cancelled) return
        setQuote(next)
        setQuoteFailed(false)
      })
      .catch(() => !cancelled && setQuoteFailed(true))
    return () => {
      cancelled = true
    }
  }, [user, values.state, values.delivery_speed, items, quoteTry])

  function change(name, value) {
    // Express only exists in Lagos, so leaving Lagos moves an express choice back to standard.
    const leavingLagos = name === 'state' && value !== 'Lagos'
    setValues((v) => ({ ...v, [name]: value, ...(leavingLagos && v.delivery_speed === 'express' ? { delivery_speed: 'standard' } : {}) }))
    setErrors((e) => ({ ...e, [name]: undefined }))
    setProblem('')
  }

  async function pay(event) {
    event.preventDefault()
    setProblem('')
    const found = validateDelivery(values)
    setErrors(found)
    const first = FIELD_ORDER.find((name) => found[name])
    if (first) {
      document.getElementById(first)?.focus()
      return
    }

    setSubmitting(true)
    try {
      const result = await apiPost('/checkout', values, { auth: true })
      // Paystack takes the payment on its own page; the shopper comes back to /checkout/complete.
      window.location.assign(result.authorization_url)
    } catch (error) {
      setSubmitting(false)
      if (Object.keys(error.fieldErrors ?? {}).length > 0) setErrors(error.fieldErrors)
      setProblem(problemFrom(error))
    }
  }

  if (user && !quote && quoteFailed) return <ErrorState page onRetry={() => setQuoteTry((n) => n + 1)} />
  if (authLoading || (user && !quote)) return <Loading count={1} />

  const bag = user ? quote?.bag : guestQuote.quote
  if (!bag && !guestQuote.loading && items.length === 0) {
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
  if (!bag) return <Loading count={1} />
  if (bag.lines.length === 0) {
    return <EmptyState title="Your bag is empty." text="Start with the brands, or an edit." actionTo="/brands" actionLabel="See the brands" />
  }

  const hasSoldOut = bag.lines.some((line) => line.issue === 'sold_out')
  const lagosStandard = values.state === 'Lagos' && values.delivery_speed === 'standard'
  const hint =
    quote && lagosStandard && bag.free_delivery_remaining_kobo > 0
      ? `You're ${formatNaira(bag.free_delivery_remaining_kobo)} away from free Lagos delivery.`
      : quote && lagosStandard
        ? 'You have unlocked free standard delivery in Lagos.'
        : ''

  return (
    <div className="checkout">
      <div className="checkout__form-side">
        <h1 className="display checkout__title">Checkout</h1>

        <Step
          number="1"
          title="Contact"
          aside={user && <span className="step__done label">✓ Done</span>}
        >
          {user ? (
            <div className="signed-in">
              <span className="signed-in__avatar" aria-hidden="true">{user.initial}</span>
              <span className="signed-in__text">
                <strong>Signed in with Google</strong>
                <span>{user.email}</span>
              </span>
              <button type="button" className="label text-link signed-in__out" onClick={signOut}>Not you?</button>
            </div>
          ) : (
            <div className="sign-in-step">
              <p>Sign in with Google to check out. Your bag is saved.</p>
              {available ? (
                <Button onClick={() => signIn('/checkout')}>CONTINUE WITH GOOGLE</Button>
              ) : (
                <p className="field__error">Sign-in is not available right now.</p>
              )}
            </div>
          )}
        </Step>

        {user && (
          <form onSubmit={pay} noValidate>
            <Step number="2" title="Delivery">
              <DeliveryFields values={values} errors={errors} options={quote?.delivery_options} onChange={change} />
            </Step>

            <Step number="3" title="Payment">
              <p className="checkout__payment-copy">
                You'll pay on Paystack's secure page by card, bank transfer or USSD, then come straight back here.
                Ọjà never sees or stores your card details.
              </p>
              {problem && (
                <p className="checkout__problem" role="alert">
                  {problem} <Link to="/bag" className="text-link">Review your bag</Link>
                </p>
              )}
              {hasSoldOut && <p className="checkout__problem" role="alert">Remove the sold-out items from your bag to pay.</p>}
              <button type="submit" className="checkout__pay" disabled={submitting || hasSoldOut || !quote}>
                {submitting ? 'TAKING YOU TO PAYSTACK…' : `PAY ${formatNaira(quote.total_kobo)} WITH PAYSTACK ↗`}
              </button>
              <p className="checkout__legal">
                By paying, you agree to Ọjà's <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
              </p>
            </Step>
          </form>
        )}
      </div>

      <CheckoutSummary
        bag={bag}
        deliveryKobo={quote ? quote.delivery_kobo : null}
        totalKobo={quote ? quote.total_kobo : null}
        hint={hint}
      />
    </div>
  )
}
