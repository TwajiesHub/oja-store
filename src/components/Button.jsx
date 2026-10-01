import { Link } from 'react-router-dom'

// A link or a button that looks like a button. `to` makes it a link.
export default function Button({ to, variant = 'primary', className = '', children, ...rest }) {
  const classes = `button button--${variant} ${className}`.trim()
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  )
}
