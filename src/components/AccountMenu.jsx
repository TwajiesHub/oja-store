import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import useAuth from '../hooks/useAuth.js'

// Desktop account control: "Sign in" when signed out, otherwise the first initial and a menu.
export default function AccountMenu() {
  const { user, loading, available, signIn, signOut } = useAuth()
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const button = useRef(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname, search])

  useEffect(() => {
    if (!open) return undefined
    function closeOnOutsideClick(event) {
      if (root.current && !root.current.contains(event.target)) setOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  if (loading || !available) return null
  if (!user) {
    return (
      <button type="button" className="account-menu__sign-in" onClick={() => signIn(`${pathname}${search}`)}>
        Sign in
      </button>
    )
  }

  return (
    <div className="account-menu" ref={root}>
      <button
        ref={button}
        type="button"
        className="account-menu__button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${user.email}`}
        onClick={() => setOpen((v) => !v)}
      >
        {user.initial}
      </button>
      {open && (
        <div className="account-menu__panel">
          <span className="account-menu__email label">{user.email}</span>
          <Link to="/orders">Your orders</Link>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  )
}
