import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import useFocusMain from '../hooks/useFocusMain.js'
import AnnouncementBar from './AnnouncementBar.jsx'
import Footer from './Footer.jsx'
import Nav from './Nav.jsx'

export default function Layout() {
  const { pathname, hash } = useLocation()
  useFocusMain()

  // A new page starts at the top, like a real page load, unless the link points at a section.
  useEffect(() => {
    const section = hash ? document.getElementById(hash.slice(1)) : null
    if (section) section.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <AnnouncementBar />
      <Nav />
      <main id="main" className="page" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
