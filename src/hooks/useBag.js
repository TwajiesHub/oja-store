import { useSyncExternalStore } from 'react'

import { acknowledgePrice, addToBag, clearBag, getItems, removeFromBag, setQuantity, subscribe } from '../lib/bagStore.js'

export default function useBag() {
  const items = useSyncExternalStore(subscribe, getItems)
  const count = items.reduce((total, item) => total + item.quantity, 0)
  // `clear` empties the browser bag without saving that back: used once a payment has emptied the saved bag.
  return { items, count, add: addToBag, setQuantity, remove: removeFromBag, acknowledgePrice, clear: clearBag }
}
