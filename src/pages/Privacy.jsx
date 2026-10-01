import ContactLine from '../components/ContactLine.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

const PROCESSORS = [
  ['Supabase', 'stores our database and handles sign-in.'],
  ['Google', 'lets you sign in with your Google account.'],
  ['Paystack', 'takes your payment on its own secure page.'],
  ['Mailgun', 'sends your order confirmation email.'],
  ['Vercel', 'hosts this website.'],
]

export default function Privacy() {
  usePageTitle('Privacy')
  return (
    <div className="legal">
      <h1 className="display legal__title">
        Privacy <span className="editorial">policy.</span>
      </h1>
      <p className="legal__intro">
        This page says what Ọjà collects about you, why, and who handles it. Ọjà is a store for made-in-Nigeria
        brands.
      </p>

      <section className="legal__section">
        <h2>What we collect</h2>
        <ul>
          <li>Your name and email address, from your Google account when you sign in.</li>
          <li>Your phone number and delivery address, which you give us at checkout.</li>
          <li>Your orders: what you bought, what you paid and when.</li>
          <li>The contents of your bag, so it follows you when you are signed in.</li>
        </ul>
        <p>We never see or store your card details. You pay on Paystack's page.</p>
      </section>

      <section className="legal__section">
        <h2>Why we collect it</h2>
        <p>To fulfil your orders: to take payment, deliver what you bought and send you a confirmation email.</p>
      </section>

      <section className="legal__section">
        <h2>Who processes it</h2>
        <ul>
          {PROCESSORS.map(([name, role]) => (
            <li key={name}>
              <strong>{name}</strong> {role}
            </li>
          ))}
        </ul>
      </section>

      <section className="legal__section" id="deletion">
        <h2>Asking us to delete your data</h2>
        <ContactLine
          before="To ask us to delete your data, email"
          fallback="To ask us to delete your data, use the shop's contact email. It is being set up."
        />
      </section>
    </div>
  )
}
