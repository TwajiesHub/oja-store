// The pure parts of the bag, kept apart from React and the network so they can be tested alone
// (src/lib/bagLogic.test.ts). Prices and stock always come from the server; the functions here
// only reshape a quote the server already sent, to show a change instantly before the answer arrives.
import type { BagLine, BagQuote } from './types'

export const MAX_QUANTITY = 10

// The most a stepper offers for a line: capped at stock and 10, and never below 1.
export function maxQuantityFor(line: Pick<BagLine, 'stock'>): number {
  return Math.max(1, Math.min(line.stock, MAX_QUANTITY))
}

function rebuilt(before: BagQuote, lines: BagLine[]): BagQuote {
  const subtotal = lines.reduce((total, line) => total + line.line_total_kobo, 0)
  const change = subtotal - before.subtotal_kobo
  return {
    ...before,
    lines,
    item_count: lines.reduce((total, line) => total + line.quantity, 0),
    subtotal_kobo: subtotal,
    // Only adjusted while the shopper is still short of free delivery: once it is 0 the threshold is
    // not known here, so it stays until the server's answer arrives.
    free_delivery_remaining_kobo:
      before.free_delivery_remaining_kobo > 0
        ? Math.max(0, before.free_delivery_remaining_kobo - change)
        : before.free_delivery_remaining_kobo,
  }
}

// The bag as it will look once `quantity` of a line is saved (capped at stock and 10).
export function withQuantity(quote: BagQuote, variantId: number, quantity: number): BagQuote {
  if (!quote.lines.some((line) => line.variant_id === variantId)) return quote
  return rebuilt(
    quote,
    quote.lines.map((line) => {
      if (line.variant_id !== variantId) return line
      const next = Math.max(1, Math.min(quantity, maxQuantityFor(line)))
      return { ...line, quantity: next, requested_quantity: next, line_total_kobo: line.unit_price_kobo * next, issue: line.issue === 'reduced' ? null : line.issue }
    }),
  )
}

export function withoutLine(quote: BagQuote, variantId: number): BagQuote {
  return rebuilt(
    quote,
    quote.lines.filter((line) => line.variant_id !== variantId),
  )
}

export type BagChange = { changedIds: number[]; removedIds: number[] }

// What another device changed: lines that are new or have a different quantity, and lines that are gone.
export function diffBags(before: BagQuote, after: BagQuote): BagChange {
  const was = new Map(before.lines.map((line) => [line.variant_id, line.quantity]))
  const now = new Set(after.lines.map((line) => line.variant_id))
  return {
    changedIds: after.lines.filter((line) => was.get(line.variant_id) !== line.quantity).map((line) => line.variant_id),
    removedIds: before.lines.filter((line) => !now.has(line.variant_id)).map((line) => line.variant_id),
  }
}

export function hasChange(change: BagChange): boolean {
  return change.changedIds.length > 0 || change.removedIds.length > 0
}
