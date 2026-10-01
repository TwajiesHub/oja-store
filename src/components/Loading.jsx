// A quiet placeholder while a page loads: `count` blocks in the product-card shape.
export default function Loading({ count = 4 }) {
  return (
    <div className="loading" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="loading__block" />
      ))}
    </div>
  )
}
