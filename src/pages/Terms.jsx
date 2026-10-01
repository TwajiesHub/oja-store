import ContactLine from '../components/ContactLine.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

export default function Terms() {
  usePageTitle('Terms')
  return (
    <div className="legal">
      <h1 className="display legal__title">
        Shop <span className="editorial">terms.</span>
      </h1>
      <p className="legal__intro">
        The plain-language terms for buying on Ọjà. One bag can hold pieces from several brands, and you pay once.
      </p>

      <section className="legal__section">
        <h2>Prices and payment</h2>
        <ul>
          <li>All prices are in naira (₦).</li>
          <li>You pay on Paystack's secure page, by card, bank transfer or USSD.</li>
          <li>Prices and stock are checked again when you pay.</li>
          <li>An order is confirmed only once we have confirmed your payment with Paystack. We then email you.</li>
        </ul>
      </section>

      <section className="legal__section" id="delivery">
        <h2>Delivery</h2>
        <ul>
          <li>
            <strong>Lagos, standard:</strong> 1 to 3 days. Free on orders of ₦50,000 or more, otherwise ₦2,500.
          </li>
          <li>
            <strong>Lagos, express:</strong> ₦5,000, delivered the same day if you order by 12:00 WAT.
          </li>
          <li>
            <strong>Other states, standard:</strong> 3 to 5 days for ₦4,500. Express is not available outside Lagos.
          </li>
        </ul>
        <p>Delivery days are working days, Monday to Friday, counted from the day you pay.</p>
      </section>

      <section className="legal__section" id="returns">
        <h2>Returns</h2>
        <p>Unused items can be returned within 7 days.</p>
        <ContactLine
          before="To start a return, email us your order number at"
          fallback="To start a return, send us your order number using the shop's contact email. It is being set up."
        />
      </section>
    </div>
  )
}
