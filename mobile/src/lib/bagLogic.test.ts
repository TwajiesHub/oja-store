import assert from 'node:assert/strict'
import { test } from 'node:test'

import { diffBags, hasChange, maxQuantityFor, withQuantity, withoutLine } from './bagLogic.ts'
import type { BagLine, BagQuote } from './types'

const brand = { slug: 'danfo', name: 'DANFO', accent: '#F2B705', accent_text: '#111110', type_pairing: 'condensed' }

function line(variant_id: number, quantity: number, overrides: Partial<BagLine> = {}): BagLine {
  return {
    variant_id,
    product_slug: `p-${variant_id}`,
    product_name: `Product ${variant_id}`,
    variant_label: 'M',
    brand,
    unit_price_kobo: 1_000_000,
    stock: 8,
    image_url: null,
    requested_quantity: quantity,
    quantity,
    line_total_kobo: 1_000_000 * quantity,
    issue: null,
    ...overrides,
  }
}

function bag(lines: BagLine[], remaining = 4_000_000): BagQuote {
  return {
    lines,
    removed_variant_ids: [],
    item_count: lines.reduce((total, l) => total + l.quantity, 0),
    subtotal_kobo: lines.reduce((total, l) => total + l.line_total_kobo, 0),
    free_delivery_remaining_kobo: remaining,
  }
}

test('the stepper maximum is stock, capped at 10, and never below 1', () => {
  assert.equal(maxQuantityFor({ stock: 3 }), 3)
  assert.equal(maxQuantityFor({ stock: 50 }), 10)
  assert.equal(maxQuantityFor({ stock: 0 }), 1)
})

test('withQuantity updates the line, the item count and the subtotal', () => {
  const next = withQuantity(bag([line(1, 1), line(2, 2)]), 1, 4)

  assert.equal(next.lines[0].quantity, 4)
  assert.equal(next.lines[0].line_total_kobo, 4_000_000)
  assert.equal(next.item_count, 6)
  assert.equal(next.subtotal_kobo, 6_000_000)
})

test('withQuantity caps at stock and at 10, and never goes below 1', () => {
  const start = bag([line(1, 1, { stock: 3 }), line(2, 1, { stock: 50 })])

  assert.equal(withQuantity(start, 1, 9).lines[0].quantity, 3)
  assert.equal(withQuantity(start, 2, 99).lines[1].quantity, 10)
  assert.equal(withQuantity(start, 1, 0).lines[0].quantity, 1)
})

test('withQuantity leaves the bag alone for a line that is not in it', () => {
  const start = bag([line(1, 1)])

  assert.equal(withQuantity(start, 99, 3), start)
})

test('withQuantity does not change the original bag', () => {
  const start = bag([line(1, 1)])
  withQuantity(start, 1, 5)

  assert.equal(start.lines[0].quantity, 1)
})

test('withQuantity clears a "reduced" flag once the quantity is set', () => {
  const start = bag([line(1, 3, { issue: 'reduced', requested_quantity: 5 })])

  assert.equal(withQuantity(start, 1, 2).lines[0].issue, null)
})

test('free-delivery remaining shrinks as the subtotal grows, and stops at 0', () => {
  const start = bag([line(1, 1)], 4_000_000)

  assert.equal(withQuantity(start, 1, 3).free_delivery_remaining_kobo, 2_000_000)
  assert.equal(withQuantity(start, 1, 8).free_delivery_remaining_kobo, 0)
})

test('free-delivery remaining is left for the server once it is already 0', () => {
  const start = bag([line(1, 8)], 0)

  assert.equal(withQuantity(start, 1, 1).free_delivery_remaining_kobo, 0)
})

test('withoutLine removes only that line and updates the totals', () => {
  const next = withoutLine(bag([line(1, 1), line(2, 2)]), 1)

  assert.deepEqual(next.lines.map((l) => l.variant_id), [2])
  assert.equal(next.item_count, 2)
  assert.equal(next.subtotal_kobo, 2_000_000)
})

test('diffBags reports new lines and changed quantities', () => {
  const change = diffBags(bag([line(1, 1), line(2, 2)]), bag([line(1, 1), line(2, 3), line(3, 1)]))

  assert.deepEqual(change.changedIds, [2, 3])
  assert.deepEqual(change.removedIds, [])
  assert.equal(hasChange(change), true)
})

test('diffBags reports lines another device removed', () => {
  const change = diffBags(bag([line(1, 1), line(2, 2)]), bag([line(2, 2)]))

  assert.deepEqual(change.changedIds, [])
  assert.deepEqual(change.removedIds, [1])
  assert.equal(hasChange(change), true)
})

test('diffBags reports nothing when the bags match, so an echo of my own change is quiet', () => {
  const same = diffBags(bag([line(1, 2)]), bag([line(1, 2)]))

  assert.equal(hasChange(same), false)
})

test('two empty bags have no change', () => {
  const change = diffBags(bag([]), bag([]))

  assert.equal(hasChange(change), false)
})
