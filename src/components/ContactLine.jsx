import { CONTACT_EMAIL } from '../lib/site.js'

// How to reach the shop. Shows the email once VITE_CONTACT_EMAIL is set, and `fallback` until then.
export default function ContactLine({ before, fallback }) {
  if (!CONTACT_EMAIL) return <p>{fallback}</p>
  return (
    <p>
      {before} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
  )
}
