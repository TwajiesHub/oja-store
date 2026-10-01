import { useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

// Checkout and payment screens drop the shop's navigation: calmer, with one way back.
export default function CheckoutLayout({ variant }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="checkout-shell">
      <header className={`checkout-header checkout-header--${variant}`}>
        <Link to="/" className="wordmark checkout-header__wordmark" aria-label="Ọjà home">Ọjà</Link>
        {variant === 'form' && (
          <>
            <span className="checkout-header__secure label"><LockIcon /> Secure checkout</span>
            <Link to="/bag" className="checkout-header__back label">← Keep shopping</Link>
          </>
        )}
      </header>
      <main id="main">
        <Outlet />
      </main>
    </div>
  )
}
