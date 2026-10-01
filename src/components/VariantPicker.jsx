import { areSizes } from '../lib/variants.js'

// Sold-out variants stay visible but can't be picked. `compact` makes the buttons small
// enough to sit inside an edit item.
export default function VariantPicker({ variants, selectedId, onSelect, legend, compact = false }) {
  const heading = legend || (areSizes(variants.map((v) => v.label)) ? 'Size' : 'Option')
  return (
    <fieldset className={`variant-picker${compact ? ' variant-picker--compact' : ''}`}>
      <legend className="label">{heading}</legend>
      <div className="variant-picker__options">
        {variants.map((variant) => {
          const soldOut = variant.stock === 0
          return (
            <button
              key={variant.id}
              type="button"
              className="variant-picker__option"
              aria-pressed={variant.id === selectedId}
              disabled={soldOut}
              onClick={() => onSelect(variant.id)}
            >
              {variant.label}
              {soldOut && <span className="variant-picker__sold-out">Sold out</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
