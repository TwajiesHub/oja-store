// The guest bag: a list of { variant_id, quantity } kept in this browser (localStorage).
// Prices and stock are never stored here; the server supplies them. Signing in and syncing
// the bag to the database comes with the bag milestone.
const STORAGE_KEY = 'oja.bag'
const MAX_QUANTITY = 10

const listeners = new Set()

function isValidEntry(entry) {
  return Number.isInteger(entry?.variant_id) && Number.isInteger(entry?.quantity) && entry.quantity > 0
}

function readStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : []
  } catch {
    return []
  }
}

let items = readStorage()

function publish(next) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private windows can refuse storage; the bag then lasts for this page view only.
  }
  listeners.forEach((listener) => listener())
}

// Keep several open tabs in step.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    items = readStorage()
    listeners.forEach((listener) => listener())
  }
})

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getItems() {
  return items
}

// Adds up to `quantity` of a variant without passing its stock or the per-variant limit.
// Returns how many were actually added (0 when the bag already holds the most allowed).
export function addToBag(variantId, quantity, stock) {
  const limit = Math.min(stock, MAX_QUANTITY)
  const current = items.find((item) => item.variant_id === variantId)?.quantity ?? 0
  const added = Math.max(0, Math.min(quantity, limit - current))
  if (added === 0) return 0

  const without = items.filter((item) => item.variant_id !== variantId)
  publish([...without, { variant_id: variantId, quantity: current + added }])
  return added
}
