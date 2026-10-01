const SORT_OPTIONS = [
  ['featured', 'Featured'],
  ['newest', 'Newest'],
  ['price_asc', 'Price, low to high'],
  ['price_desc', 'Price, high to low'],
]

// Category chips on the left, brand and sort on the right. Reports changes by name.
// `brands` is optional: the brand page already belongs to one brand.
export default function FilterBar({ categories, brands, category, brand, sort, onChange }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__chips" role="group" aria-label="Category">
        {categories.length > 0 && (
          <button type="button" className="chip" aria-pressed={!category} onClick={() => onChange('category', '')}>
            All
          </button>
        )}
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            className="chip"
            aria-pressed={category === c.slug}
            onClick={() => onChange('category', c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="filter-bar__selects">
        {brands && brands.length > 0 && (
          <label className="filter-bar__select">
            <span className="label">Brand</span>
            <select value={brand} onChange={(e) => onChange('brand', e.target.value)}>
              <option value="">All brands</option>
              {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </label>
        )}
        <label className="filter-bar__select">
          <span className="label">Sort</span>
          <select value={sort} onChange={(e) => onChange('sort', e.target.value)}>
            {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
