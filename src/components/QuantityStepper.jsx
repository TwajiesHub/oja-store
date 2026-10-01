// Quantity from 1 up to `max` (the lower of stock and the per-variant limit).
export default function QuantityStepper({ value, max, onChange }) {
  return (
    <div className="quantity-stepper">
      <button type="button" aria-label="Remove one" onClick={() => onChange(value - 1)} disabled={value <= 1}>
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label="Add one" onClick={() => onChange(value + 1)} disabled={value >= max}>
        +
      </button>
    </div>
  )
}
