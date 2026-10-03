// Money is always integer kobo. Convert to naira only here, for display.
// Done by hand so it does not depend on the phone's Intl support: 6800000 -> "₦68,000".
export function formatNaira(kobo: number): string {
  const naira = Math.round(kobo / 100)
  return `₦${naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}
