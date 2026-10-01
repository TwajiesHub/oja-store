// Clothing sizes, shoe sizes, and measures like "100 ml" or "15 g".
const SIZE_LABEL = /^(XXS|XS|S|M|L|XL|XXL|\d+|\d+ ?(ml|g))$/

export function areSizes(labels) {
  return labels.every((label) => SIZE_LABEL.test(label))
}

// The short line under a product name: "S to XXL", "100 ml or 250 ml", "one size".
export function variantSummary(labels) {
  if (labels.length === 1) return labels[0].toLowerCase()
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`
  if (areSizes(labels)) return `${labels[0]} to ${labels[labels.length - 1]}`
  return `${labels.length} options`
}
