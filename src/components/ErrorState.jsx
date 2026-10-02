import Button from './Button.jsx'

// `page` is for a screen that has no heading of its own when it fails to load: it gets a hidden
// one, so the page still has a title for screen readers.
export default function ErrorState({ onRetry, page = false }) {
  return (
    <div className="state" role="alert">
      {page && <h1 className="visually-hidden">This page did not load</h1>}
      <p className="state__text">We couldn't load this right now. Check your connection and try again.</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}
