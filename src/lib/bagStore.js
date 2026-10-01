// The guest bag: a list of { variant_id, quantity, seen_price_kobo } kept in this browser
// (localStorage). The price is only what the shopper last saw, so the bag page can say when
// it changed. It is never used to charge anyone: the server prices every request.
// Signing in and syncing the bag to the database comes with the sign-in milestone.
const STORAGE_KEY = 'oja.bag'
const MAX_QUANTITY = 10

const listeners = new Set()

function isValidEntry(entry) {
  return (
    Number.isInteger(entry?.variant_id) &&
    Number.isInteger(entry?.quantity) &&
    entry.quantity > 0 &&
    (entry.seen_price_kobo === undefined || Number.isInteger(entry.seen_price_kobo))
  )
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

function updateEntry(variantId, change) {
  publish(items.map((item) => (item.variant_id === variantId ? { ...item, ...change } : item)))
}

// Adds up to `quantity` of a variant without passing its stock or the per-variant limit.
// Returns how many were actually added (0 when the bag already holds the most allowed).
export function addToBag(variantId, quantity, stock, priceKobo) {
  const limit = Math.min(stock, MAX_QUANTITY)
  const existing = items.find((item) => item.variant_id === variantId)
  const current = existing?.quantity ?? 0
  const added = Math.max(0, Math.min(quantity, limit - current))
  if (added === 0) return 0

  const entry = { variant_id: variantId, quantity: current + added, seen_price_kobo: priceKobo }
  publish(existing ? items.map((item) => (item === existing ? entry : item)) : [...items, entry])
  return added
}

export function setQuantity(variantId, quantity) {
  updateEntry(variantId, { quantity: Math.min(Math.max(quantity, 1), MAX_QUANTITY) })
}

export function removeFromBag(variantIds) {
  const gone = new Set(variantIds)
  publish(items.filter((item) => !gone.has(item.variant_id)))
}

// The shopper has seen the current price (or this item never had one recorded).
export function acknowledgePrice(variantId, priceKobo) {
  updateEntry(variantId, { seen_price_kobo: priceKobo })
}
