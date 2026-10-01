import { useSyncExternalStore } from 'react'

import { acknowledgePrice, addToBag, getItems, removeFromBag, setQuantity, subscribe } from '../lib/bagStore.js'

export default function useBag() {
  const items = useSyncExternalStore(subscribe, getItems)
  const count = items.reduce((total, item) => total + item.quantity, 0)
  return { items, count, add: addToBag, setQuantity, remove: removeFromBag, acknowledgePrice }
}
