import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import AnnouncementBar from './AnnouncementBar.jsx'
import Footer from './Footer.jsx'
import Nav from './Nav.jsx'

export default function Layout() {
  const { pathname } = useLocation()

  // A new page should start at the top, like a real page load.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <AnnouncementBar />
      <Nav />
      <main id="main" className="page">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
