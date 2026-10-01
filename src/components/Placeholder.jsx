import BrandChip from './BrandChip.jsx'

// Stands in for a product photo until real ones arrive: stone, the brand chip and the name.
// `showBrand` is false where the whole page already belongs to one brand.
export default function Placeholder({ brand, name, showBrand = true }) {
  return (
    <div className="placeholder">
      {showBrand && <BrandChip brand={brand} />}
      <span className="placeholder__name">{name}</span>
    </div>
  )
}
