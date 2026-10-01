import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import EditItem from '../components/EditItem.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { CoralStrand, SunHazeWide } from '../components/Illustrations.jsx'
import Loading from '../components/Loading.jsx'
import useApi from '../hooks/useApi.js'
import useBag from '../hooks/useBag.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { kitStyle } from '../lib/brandKit.js'
import { formatNaira } from '../lib/money.js'
import { editItemTitle } from '../lib/variants.js'
import NotFound from './NotFound.jsx'

const HERO_GRAPHICS = { owambe: CoralStrand, harmattan: SunHazeWide }

function pieces(count) {
  return `${count} ${count === 1 ? 'piece' : 'pieces'}`
}

function addAllMessage(added, skipped) {
  const parts = [added.length ? `Added ${pieces(added.length)} to your bag.` : 'Nothing was added.']
  for (const { title, reason } of skipped) {
    parts.push(
      reason === 'sold-out'
        ? `${title} is sold out, so we left it out.`
        : `${title} is already in your bag at the most you can buy.`,
    )
  }
  return parts.join(' ')
}

function EditHero({ edit, number }) {
  const Graphic = HERO_GRAPHICS[edit.slug]
  return (
    <section className="edit-hero" style={kitStyle(edit)}>
      {Graphic && <Graphic />}
      <span className="edit-hero__label label">
        Edit 0{number} · {edit.kicker} · Chosen by the Ọjà team
      </span>
      <h1 className="edit-hero__title editorial">{edit.title}</h1>
      <p className="edit-hero__intro">{edit.intro}</p>
      <span className="edit-hero__total label">
        {pieces(edit.available_count)}
        {edit.available_count > 0 && ` · ${formatNaira(edit.total_kobo)} together`}
      </span>
    </section>
  )
}

function EditView({ edit, number, next }) {
  const { add } = useBag()
  const [justAdded, setJustAdded] = useState(null)
  const [message, setMessage] = useState('')

  function addOne(item) {
    const { default_variant: variant } = item
    const added = add(variant.id, 1, variant.stock)
    setJustAdded(added > 0 ? item.product.id : null)
    setMessage(added > 0 ? '' : `${editItemTitle(item.product, variant)} is already in your bag at the most you can buy.`)
  }

  function addAll() {
    const added = []
    const skipped = []
    for (const item of edit.items) {
      const { default_variant: variant } = item
      const title = editItemTitle(item.product, variant)
      if (variant.stock === 0) skipped.push({ title, reason: 'sold-out' })
      else if (add(variant.id, 1, variant.stock) > 0) added.push(title)
      else skipped.push({ title, reason: 'maxed' })
    }
    setJustAdded(null)
    setMessage(addAllMessage(added, skipped))
  }

  return (
    <div className="edit-page">
      <nav className="breadcrumb label" aria-label="Breadcrumb">
        <Link to="/">Ọjà</Link>
        <span aria-hidden="true">/</span>
        <Link to="/edits">Edits</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{edit.title}</span>
      </nav>

      <EditHero edit={edit} number={number} />

      <section className="edit-items">
        {edit.items.map((item) => (
          <EditItem key={item.position} item={item} justAdded={justAdded === item.product.id} onAdd={addOne} />
        ))}
      </section>

      <p className="edit-page__message" role="status">{message}</p>

      {edit.available_count > 0 && (
        <section className="look-bar">
          <div className="look-bar__text">
            <span className="label">Shop the whole look</span>
            <span className="look-bar__total">
              {pieces(edit.available_count)} · <span className="look-bar__price">{formatNaira(edit.total_kobo)}</span>
            </span>
          </div>
          <button type="button" className="look-bar__add" onClick={addAll}>
            ADD ALL {edit.available_count} TO BAG ↗
          </button>
        </section>
      )}

      {next && (
        <Link to={`/edits/${next.slug}`} className="next-edit" style={kitStyle(next)}>
          <span className="next-edit__text">
            <span className="label">Next edit</span>
            <span className="next-edit__title editorial">{next.title}</span>
          </span>
          <span className="label text-link">Shop the edit ↗</span>
        </Link>
      )}
    </div>
  )
}

export default function Edit() {
  const { slug } = useParams()
  const edit = useApi(`/edits/${slug}`)
  const edits = useApi('/edits')
  usePageTitle(edit.data?.title)

  if (edit.error?.status === 404) return <NotFound />
  const failed = [edit, edits].find((r) => r.error)
  if (failed) return <ErrorState onRetry={failed.reload} />
  if (!edit.data || !edits.data) return <Loading count={1} />

  const index = edits.data.findIndex((e) => e.slug === slug)
  const others = edits.data.filter((e) => e.slug !== slug)
  // The next edit in order, wrapping round to the first.
  const next = others.find((e) => edits.data.indexOf(e) > index) || others[0]

  // key restarts the add-to-bag feedback when you move to another edit
  return <EditView key={edit.data.slug} edit={edit.data} number={index + 1} next={next} />
}
