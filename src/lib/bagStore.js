// The bag kept in this browser (localStorage): a list of { variant_id, quantity, seen_price_kobo }.
// Signed out it is the whole bag. Signed in it mirrors the saved bag, which bagSync.js keeps
// up to date. The price is only what the shopper last saw, so the bag page can say when it
// changed. It is never used to charge anyone: the server prices every request.
const STORAGE_KEY = 'oja.bag'
const MAX_QUANTITY = 10

const listeners = new Set()
const localChangeListeners = new Set()

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

// `byShopper` is false when the server, not the shopper, changed the bag (so it is not sent back).
function publish(next, byShopper = true) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private windows can refuse storage; the bag then lasts for this page view only.
  }
  listeners.forEach((listener) => listener())
  if (byShopper) localChangeListeners.forEach((listener) => listener())
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

// Called only when the shopper changes the bag (add, quantity, remove).
export function onShopperChange(listener) {
  localChangeListeners.add(listener)
  return () => localChangeListeners.delete(listener)
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

// For bagSync only: swap in the saved bag from the server, or empty the bag on sign-out.
export function replaceItems(next) {
  publish(next, false)
}

export function clearBag() {
  publish([], false)
}
