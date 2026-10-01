import EditTile from '../components/EditTile.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import useApi from '../hooks/useApi.js'
import usePageTitle from '../hooks/usePageTitle.js'

export default function Edits() {
  usePageTitle('Edits')
  const { data, error, loading, reload } = useApi('/edits')

  return (
    <div className="listing">
      <h1 className="display listing__title">
        The <span className="editorial">edits.</span>
      </h1>
      <p className="listing__lead">Themed selections that tell a story across brands.</p>
      {error && <ErrorState onRetry={reload} />}
      {loading && <Loading count={2} />}
      {data && (
        <div className="edit-tiles">
          {data.map((edit, index) => <EditTile key={edit.slug} edit={edit} number={index + 1} />)}
        </div>
      )}
    </div>
  )
}
