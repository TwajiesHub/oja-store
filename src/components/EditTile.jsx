import { Link } from 'react-router-dom'

import { kitStyle } from '../lib/brandKit.js'
import { CoralBeads, SunHaze } from './Illustrations.jsx'

const GRAPHICS = { owambe: CoralBeads, harmattan: SunHaze }

export default function EditTile({ edit, number }) {
  const Graphic = GRAPHICS[edit.slug]
  return (
    <Link to={`/edits/${edit.slug}`} className="edit-tile" style={kitStyle(edit)}>
      {Graphic && <Graphic />}
      <span className="edit-tile__label label">
        Edit 0{number}
        <span className="only-desktop"> · {edit.kicker}</span> · {edit.piece_count} pieces
      </span>
      <span className="edit-tile__title editorial">{edit.title}</span>
      <span className="edit-tile__foot">
        <span className="edit-tile__intro">{edit.intro}</span>
        <span className="edit-tile__link label text-link">Shop the edit ↗</span>
      </span>
    </Link>
  )
}
