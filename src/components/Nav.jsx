import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

const LINKS = [
  { to: '/shop', label: 'Shop all' },
  { to: '/brands', label: 'Brands' },
  { to: '/edits', label: 'Edits' },
  { to: '/shop?category=clothing', label: 'Clothing', category: 'clothing' },
  { to: '/shop?category=beauty', label: 'Beauty', category: 'beauty' },
  { to: '/shop?category=jewellery', label: 'Jewellery', category: 'jewellery' },
  { to: '/shop?category=leather-home', label: 'Home', category: 'leather-home' },
]

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="20" y1="12" x2="4" y2="12" />
      <polyline points="10 6 4 12 10 18" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
    </svg>
  )
}

export default function Nav({ bagCount = 0 }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const onProductPage = location.pathname.startsWith('/products/')
  const category = new URLSearchParams(location.search).get('category')

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  function goBack() {
    // A page opened directly has no history to go back to.
    if (location.key === 'default') navigate('/shop')
    else navigate(-1)
  }

  // The category links all live on /shop, so NavLink's own matching can't tell them apart.
  function isActive(link) {
    if (link.category) return location.pathname === '/shop' && category === link.category
    if (link.to === '/shop') return location.pathname === '/shop' && !category
    return location.pathname.startsWith(link.to)
  }

  function renderLinks() {
    return LINKS.map((link) => (
      <NavLink
        key={link.label}
        to={link.to}
        className={isActive(link) ? 'is-active' : undefined}
        aria-current={isActive(link) ? 'page' : undefined}
      >
        {link.label}
      </NavLink>
    ))
  }

  return (
    <header className="site-nav">
      <div className="site-nav__bar">
        {onProductPage ? (
          <button type="button" className="site-nav__icon" aria-label="Back" onClick={goBack}>
            <BackIcon />
          </button>
        ) : (
          <button
            type="button"
            className="site-nav__icon"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
        )}
        <Link to="/" className="site-nav__wordmark wordmark" aria-label="Ọjà home">Ọjà</Link>
        <nav className="site-nav__links" aria-label="Main">{renderLinks()}</nav>
        <div className="site-nav__right">
          <button type="button" className="site-nav__signin">Sign in</button>
          <Link to="/bag" className="site-nav__bag label">Bag ({bagCount})</Link>
        </div>
      </div>
      <nav id="site-menu" className="site-nav__panel" aria-label="Menu" hidden={!open}>
        {renderLinks()}
        <button type="button" className="site-nav__panel-signin">Sign in</button>
      </nav>
    </header>
  )
}
