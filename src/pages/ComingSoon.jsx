import EmptyState from '../components/EmptyState.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

// Stands in for pages that arrive in a later milestone, so links never lead to a false 404.
export default function ComingSoon({ title }) {
  usePageTitle(title)
  return (
    <EmptyState
      title={`${title} opens soon.`}
      text="This part of the shop isn't ready yet. The brands are."
      actionTo="/brands"
      actionLabel="See the brands"
    />
  )
}
