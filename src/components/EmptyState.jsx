import { Link } from 'react-router-dom'

import Button from './Button.jsx'

export default function EmptyState({ title, text, actionTo, actionLabel, secondaryTo, secondaryLabel }) {
  return (
    <div className="state">
      {title && <h1 className="display state__title">{title}</h1>}
      <p className="state__text">{text}</p>
      {actionTo && <Button to={actionTo}>{actionLabel}</Button>}
      {secondaryTo && <Link to={secondaryTo} className="label text-link">{secondaryLabel}</Link>}
    </div>
  )
}
