// Dates arrive from the server as plain days ("2026-10-05"). Parse them as local days so they
// never slip to the day before in another time zone.
function parseDay(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

// "Mon 5 – Wed 7 Oct", or "Fri 2 Oct" when it is a single day.
export function formatArrival(fromIso, toIso) {
  const from = parseDay(fromIso)
  const to = parseDay(toIso)
  const withWeekday = (date) => `${weekday.format(date)} ${date.getDate()}`
  if (fromIso === toIso) return `${weekday.format(from)} ${dayMonth.format(from)}`
  const sameMonth = from.getMonth() === to.getMonth()
  const start = sameMonth ? withWeekday(from) : `${weekday.format(from)} ${dayMonth.format(from)}`
  return `${start} – ${weekday.format(to)} ${dayMonth.format(to)}`
}

// A moment from the server ("2026-10-01T09:14:00Z") as the day it was in Lagos: "2 Oct 2026".
const lagosDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })

export function formatPaidDay(isoMoment) {
  return lagosDay.format(new Date(isoMoment))
}
