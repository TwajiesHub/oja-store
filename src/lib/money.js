// Money is always integer kobo. Convert to naira only here, for display.
const KOBO_PER_NAIRA = 100

const nairaFormat = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

export function formatNaira(kobo) {
  return nairaFormat.format(kobo / KOBO_PER_NAIRA)
}
