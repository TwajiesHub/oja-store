import EmptyState from '../components/EmptyState.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

export default function NotFound() {
  usePageTitle('Page not found')
  return (
    <EmptyState
      title="We couldn't find that page."
      text="It may have moved, or the link may be wrong. Start with the brands, or an edit."
      actionTo="/brands"
      actionLabel="See the brands"
    />
  )
}
