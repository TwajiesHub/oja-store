import { Link } from 'react-router-dom'

import { isLightKit, kitStyle } from '../lib/brandKit.js'

export default function BrandTile({ brand }) {
  const light = isLightKit(brand) ? ' brand-tile--light' : ''
  return (
    <Link
      to={`/brands/${brand.slug}`}
      className={`brand-tile kit-${brand.type_pairing}${light}`}
      style={kitStyle(brand)}
    >
      <span className="brand-tile__label label">
        {brand.descriptor}
        <span className="only-desktop"> · {brand.city.split(' ')[0]}</span>
      </span>
      <span className="brand-tile__name">{brand.name}</span>
      <span className="brand-tile__arrow" aria-hidden="true">↗</span>
    </Link>
  )
}
