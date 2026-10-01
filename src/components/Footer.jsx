import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__group">
          <span className="label">Shop</span>
          <Link to="/shop">Shop all</Link>
          <Link to="/brands">Brands</Link>
          <Link to="/edits">Edits</Link>
        </div>
        <div className="site-footer__group">
          <span className="label">Help</span>
          <Link to="/terms#delivery">Delivery</Link>
          <Link to="/orders">Your orders</Link>
          <Link to="/terms#returns">Returns</Link>
        </div>
        <div className="site-footer__group">
          <span className="label">Ọjà</span>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </div>
      <div className="site-footer__bottom">
        <span className="site-footer__wordmark wordmark" aria-hidden="true">Ọjà</span>
        <span className="site-footer__note label">
          Ọjà: Yoruba for market
          <br />
          © 2026 · Lagos
        </span>
      </div>
    </footer>
  )
}
