import { Link } from 'react-router-dom'

import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import SignInPrompt from '../components/SignInPrompt.jsx'
import useApi from '../hooks/useApi.js'
import useAuth from '../hooks/useAuth.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatPaidDay } from '../lib/dates.js'
import { formatNaira } from '../lib/money.js'

export default function Orders() {
  usePageTitle('Your orders')
  const { user, loading: authLoading } = useAuth()
  const { data, error, loading, reload } = useApi('/orders', { auth: true, skip: !user })

  if (authLoading) return <Loading count={1} />
  if (!user) {
    return (
      <SignInPrompt
        title="Sign in to see your orders."
        text="Your orders are saved to your Google account."
        returnPath="/orders"
      />
    )
  }
  if (error) return <ErrorState onRetry={reload} />
  if (loading || !data) return <Loading count={2} />
  if (data.length === 0) {
    return (
      <EmptyState
        title="No orders yet."
        text="When you pay for something, it shows up here. Start with the brands, or an edit."
        actionTo="/brands"
        actionLabel="See the brands"
        secondaryTo="/edits"
        secondaryLabel="Or see the edits"
      />
    )
  }

  return (
    <div className="orders">
      <h1 className="display orders__title">Your orders</h1>
      <ul className="orders__list">
        {data.map((order) => (
          <li key={order.number}>
            <Link to={`/orders/${order.number}`} className="order-row">
              <span className="order-row__number">{order.number}</span>
              <span className="order-row__meta">
                {formatPaidDay(order.paid_at)} · {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
              </span>
              <span className="order-row__total">{formatNaira(order.total_kobo)}</span>
              <span className="order-row__status label">Paid</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
