# Ọjà

Ọjà ("market" in Yoruba) is a curated online store for made-in-Nigeria brands. Shoppers browse
six independent brands and themed edits, fill one bag, sign in with Google and pay once with
Paystack. The order is saved in Supabase and a confirmation email is sent through Mailgun.

Live: <https://oja-store-seven.vercel.app>

## Order confirmation emails

After a payment is confirmed, Ọjà emails the shopper a receipt through Mailgun.

**While the shop runs on Mailgun's sandbox domain, receipts only reach authorized recipients.**
Mailgun's sandbox refuses to deliver to any address that has not been added as an authorized
recipient in the Mailgun dashboard. If you place a test order with another address, the order
is still saved and paid, it shows under **Your orders**, and the payment screen says the receipt
could not be sent yet. A verified sending domain removes this limit.

A real confirmation email, sent through Mailgun:

![The Ọjà order confirmation email](docs/images/confirmation-email.png)

_The rest of this README (features, stack, how payments are verified, running and testing locally,
and how AI was used) is written in the polish milestone._
