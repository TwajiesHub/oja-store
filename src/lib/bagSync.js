// Keeps the browser bag and the signed-in user's saved bag in step.
//
// Signed out, the bag lives only in this browser. When someone signs in:
//   - if this browser's bag already belongs to them (a mirror of their saved bag), the saved bag
//     is loaded and wins;
//   - otherwise it is a guest bag, and it is merged into the saved bag on the server (quantities
//     add up, capped at stock and 10). Merging a mirror would double every quantity, which is
//     why the owner is remembered.
// After that, every change the shopper makes is saved to the server. Signing out empties the
// browser bag so the next person on a shared device starts fresh.
import { apiGet, apiPost, apiPut, apiPutOnExit } from './api.js'
import { clearBag, getItems, onShopperChange, replaceItems } from './bagStore.js'

const OWNER_KEY = 'oja.bag.owner'
const SAVE_DELAY_MS = 300
const RETRY_DELAY_MS = 2000
const MAX_ATTEMPTS = 3

function readOwner() {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function writeOwner(userId) {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId)
    else localStorage.removeItem(OWNER_KEY)
  } catch {
    // Without storage the bag simply starts again as a guest bag on the next visit.
  }
}

function toRequest(items) {
  return { items: items.map(({ variant_id, quantity }) => ({ variant_id, quantity })) }
}

// The saved bag becomes the browser bag. Prices the shopper already saw are kept, so the
// bag page can still say when one changed.
function adoptSavedBag(quote) {
  const seen = new Map(getItems().map((item) => [item.variant_id, item.seen_price_kobo]))
  replaceItems(
    quote.lines.map((line) => ({
      variant_id: line.variant_id,
      quantity: line.requested_quantity,
      seen_price_kobo: seen.get(line.variant_id) ?? line.unit_price_kobo,
    })),
  )
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Starts syncing for `userId` (or the signed-out state when null). Returns a function that stops it.
export function startBagSync(userId) {
  let stopped = false
  let saveTimer = null
  let stopListening = () => {}
  let stopFlushing = () => {}

  if (!userId) {
    if (readOwner()) {
      clearBag()
      writeOwner(null)
    }
    return () => {}
  }

  async function save() {
    try {
      await apiPut('/bag', toRequest(getItems()), { auth: true })
    } catch {
      // The next change saves the whole bag again.
    }
  }

  // A save still waiting for its short delay would be lost if the page closes first, so send it
  // now, in a way that survives the page going away.
  function flushPending() {
    if (saveTimer === null) return
    clearTimeout(saveTimer)
    saveTimer = null
    apiPutOnExit('/bag', toRequest(getItems()))
  }

  function flushWhenHidden() {
    if (document.visibilityState === 'hidden') flushPending()
  }

  async function begin() {
    // A bag that mirrors someone else's saved bag must never be merged into this user's.
    const owner = readOwner()
    if (owner && owner !== userId) {
      clearBag()
      writeOwner(null)
    }
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !stopped; attempt += 1) {
      try {
        const quote =
          readOwner() === userId
            ? await apiGet('/bag', { auth: true })
            : await apiPost('/bag/merge', toRequest(getItems()), { auth: true })
        if (stopped) return
        adoptSavedBag(quote)
        writeOwner(userId)
        stopListening = onShopperChange(() => {
          clearTimeout(saveTimer)
          saveTimer = setTimeout(() => {
            saveTimer = null
            save()
          }, SAVE_DELAY_MS)
        })
        document.addEventListener('visibilitychange', flushWhenHidden)
        window.addEventListener('pagehide', flushPending)
        stopFlushing = () => {
          document.removeEventListener('visibilitychange', flushWhenHidden)
          window.removeEventListener('pagehide', flushPending)
        }
        return
      } catch {
        await wait(RETRY_DELAY_MS)
      }
    }
  }

  begin()
  return () => {
    stopped = true
    clearTimeout(saveTimer)
    stopListening()
    stopFlushing()
  }
}
