import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// After the shopper follows a link, move focus to the page content so a keyboard or screen
// reader user starts there, not on a link that no longer exists. Opening the site, and going
// back or forward, are left to the browser.
export default function useFocusMain() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'PUSH') document.getElementById('main')?.focus({ preventScroll: true })
    // Only a change of page counts, not a change of filters on the same page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
}
