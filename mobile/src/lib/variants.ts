// Same rules as the website's variants.js.
const SIZE_LABEL = /^(XXS|XS|S|M|L|XL|XXL|\d+|\d+ ?(ml|g))$/

export function areSizes(labels: string[]): boolean {
  return labels.every((label) => SIZE_LABEL.test(label))
}

// The short line under a product name: "S to XXL", "100 ml or 250 ml", "one size".
export function variantSummary(labels: string[]): string {
  if (labels.length === 1) return labels[0].toLowerCase()
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`
  if (areSizes(labels)) return `${labels[0]} to ${labels[labels.length - 1]}`
  return `${labels.length} options`
}

export function isApparelSize(label: string): boolean {
  return /^(XXS|XS|S|M|L|XL|XXL|\d+)$/.test(label)
}
