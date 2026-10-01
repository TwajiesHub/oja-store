// Clothing sizes, shoe sizes, and measures like "100 ml" or "15 g".
const SIZE_LABEL = /^(XXS|XS|S|M|L|XL|XXL|\d+|\d+ ?(ml|g))$/

// Sizes like S or 42, where a shopper must choose their own, unlike colours or volumes.
export function isApparelSize(label) {
  return /^(XXS|XS|S|M|L|XL|XXL|\d+)$/.test(label)
}

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

// An edit curates a specific variant (Wine, 250 ml), so it joins the name. A size is the
// shopper's choice, so it stays off the name.
export function editItemTitle(product, variant) {
  if (product.variant_labels.length < 2 || isApparelSize(variant.label)) return product.name
  return `${product.name}, ${variant.label}`
}
