import Button from './Button.jsx'

export default function ErrorState({ onRetry }) {
  return (
    <div className="state" role="alert">
      <p className="state__text">We couldn't load this right now. Check your connection and try again.</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}
