import Button from './Button.jsx'

export default function EmptyState({ title, text, actionTo, actionLabel }) {
  return (
    <div className="state">
      {title && <h1 className="display state__title">{title}</h1>}
      <p className="state__text">{text}</p>
      {actionTo && <Button to={actionTo}>{actionLabel}</Button>}
    </div>
  )
}
