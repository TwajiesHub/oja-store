import BrandTile from '../components/BrandTile.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import useApi from '../hooks/useApi.js'
import usePageTitle from '../hooks/usePageTitle.js'

export default function Brands() {
  usePageTitle('Brands')
  const { data, error, loading, reload } = useApi('/brands')

  return (
    <div className="listing">
      <h1 className="display listing__title">
        Six brands. <span className="editorial">One bag.</span>
      </h1>
      {error && <ErrorState onRetry={reload} />}
      {loading && <Loading count={6} />}
      {data && data.length === 0 && (
        <EmptyState text="No brands are listed right now. Check back soon." actionTo="/" actionLabel="Back to the home page" />
      )}
      {data && data.length > 0 && (
        <div className="brand-tiles brand-tiles--index">
          {data.map((brand) => <BrandTile key={brand.slug} brand={brand} />)}
        </div>
      )}
    </div>
  )
}
