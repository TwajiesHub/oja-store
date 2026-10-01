import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Button from '../components/Button.jsx'
import Loading from '../components/Loading.jsx'
import { ConfirmingScreen, FailedScreen, MissingScreen, PaidScreen } from '../components/PaymentScreens.jsx'
import useAuth from '../hooks/useAuth.js'
import useBag from '../hooks/useBag.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { apiGet, apiPost } from '../lib/api.js'

const VERIFY_POLL_MS = 3000
const CONFIRM_WINDOW_MS = 30000

// "OJA-10482-1" belongs to order "OJA-10482".
const orderNumberFrom = (reference) => reference.replace(/-\d+$/, '')

// Where Paystack sends the shopper back to. The address proves nothing: the server asks
// Paystack what really happened, and only then does the page show paid, failed or confirming.
export default function CheckoutComplete() {
  usePageTitle('Your payment')
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref') || ''
  const { user, loading, available, signIn } = useAuth()
  const { clear: clearBag } = useBag()

  const [phase, setPhase] = useState('confirming')
  const [order, setOrder] = useState(null)
  const [orderNumber, setOrderNumber] = useState(orderNumberFrom(reference))
  const [slow, setSlow] = useState(false)
  const [round, setRound] = useState(0)
  const [trying, setTrying] = useState(false)
  const [retryProblem, setRetryProblem] = useState('')

  // Ask the server every few seconds for up to 30 seconds. "Check again" starts a new round.
  useEffect(() => {
    if (loading || !user || !reference) return undefined
    let cancelled = false
    let timer
    const startedAt = Date.now()
    setSlow(false)

    async function check() {
      try {
        const result = await apiPost('/payments/verify', { reference }, { auth: true })
        if (cancelled) return
        setOrderNumber(result.order_number)
        if (result.status === 'paid') {
          const paidOrder = await apiGet(`/orders/${result.order_number}`, { auth: true })
          if (cancelled) return
          clearBag()
          setOrder(paidOrder)
          setPhase('paid')
          return
        }
        if (result.status === 'failed') {
          setPhase('failed')
          return
        }
      } catch (error) {
        if (cancelled) return
        if (error.status === 404 || error.status === 403) {
          setPhase('missing')
          return
        }
        // Anything else (a dropped connection) is treated as "not yet" and tried again.
      }
      if (Date.now() - startedAt >= CONFIRM_WINDOW_MS) {
        setSlow(true)
        return
      }
      timer = setTimeout(check, VERIFY_POLL_MS)
    }

    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [loading, user, reference, round, clearBag])

  async function tryAgain() {
    setTrying(true)
    setRetryProblem('')
    try {
      const result = await apiPost(`/orders/${orderNumber}/pay`, undefined, { auth: true })
      window.location.assign(result.authorization_url)
    } catch (error) {
      setTrying(false)
      setRetryProblem(error.detail || 'We could not start the payment again. Go back to your bag and try once more.')
    }
  }

  if (loading) return <Loading count={1} />
  if (!reference) return <MissingScreen />
  if (!user) {
    return (
      <div className="result">
        <h1 className="display result__title">Sign in to see <span className="editorial">your payment.</span></h1>
        <p className="result__text">Sign in with the account you used to check out.</p>
        {available && <Button onClick={() => signIn(`/checkout/complete?reference=${encodeURIComponent(reference)}`)}>CONTINUE WITH GOOGLE</Button>}
      </div>
    )
  }

  if (phase === 'paid' && order) return <PaidScreen order={order} />
  if (phase === 'failed') return <FailedScreen orderNumber={orderNumber} onTryAgain={tryAgain} trying={trying} problem={retryProblem} />
  if (phase === 'missing') return <MissingScreen />
  return <ConfirmingScreen orderNumber={orderNumber} slow={slow} onCheckAgain={() => setRound((n) => n + 1)} />
}
