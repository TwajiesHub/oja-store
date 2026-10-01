# PRD: Ọjà, a market for made-in-Nigeria

- Owner: Uwajie Bonnke
- Context: HNG Internship 15, Task 2
- Deadline: Friday 2 Oct 2026 (feature cutoff 15:00 WAT, submit by 20:00 WAT)
- Live: `https://oja-store-seven.vercel.app`

## Task brief (must all be met)

1. A website for a shop, with a checkout page.
2. Everything persisted in a database using **Supabase**.
3. Confirmation emails sent with **Mailgun**.
4. **Google sign-in** set up through Google Cloud Console.

We add: real payments with **Paystack** (test mode for submission), so it's a
fully usable shop.

## Problem and idea

Small Nigerian brands make excellent work but each sells alone, through
Instagram DMs and bank transfers. Shoppers can't discover them together or pay
for several in one go. **Ọjà** curates them into one store: one bag, one
checkout, one delivery. **Edits** (themed selections like "The Owambe Edit")
tell stories across brands.

## Users

- **Shoppers in Nigeria**, mostly on phones, often on mobile data.
- **HNG reviewers**, who will browse, sign in with Google, pay with a Paystack
  test card and expect a confirmation email.

## Goals

1. Meet every point of the brief, end to end, on the live URL.
2. A shopper can go from the home page to a paid order in under 3 minutes on a phone.
3. Look like a premium store (see `design/` and `TASTE.md`), not a template.
4. Never charge wrongly, never lose an order, never double-count stock.

## Out of scope for this deadline

Brand self-service (brands managing their own products), payouts to brands,
an admin dashboard (products are managed in the Supabase dashboard), refunds and
returns screens, delivery tracking, reviews and ratings, wishlists, discount
codes, full-text search, multiple currencies, live Paystack keys.

## Requirements

### Catalogue
| ID | Requirement |
| --- | --- |
| C1 | **Home** as in `design/OjaHome.html` and `design/OjaHomePhone.html`: cover story, brand tiles, edits, new arrivals, categories, promises, footer. |
| C2 | **Shop all** (`/shop`) with filters for category and brand, and sort (featured, newest, price low to high, price high to low). Filters live in the URL query string. |
| C3 | **Brand page** (`/brands/:slug`) as in `design/OjaBrand.html`: the brand block uses that brand's kit (accent, text colour, type pairing), product grid with category chips, brand story, more brands. |
| C4 | **Product page** (`/products/:slug`) as in `design/OjaProduct.html`: images or placeholder, brand link, variant picker, quantity (1 to available stock, max 10), add to bag, details, "In the edits", more from the brand. Out-of-stock variants are shown but disabled. |
| C5 | **Brands index** (`/brands`): all brand tiles. |

### Edits
| ID | Requirement |
| --- | --- |
| E1 | **Edit page** (`/edits/:slug`) as in `design/OjaEdit.html`: hero in the edit's accent, numbered items with brand chip, name, curator's note, price, "Add to bag". |
| E2 | **"Add all to bag"** adds each item's default variant (quantity 1), skipping anything out of stock and saying so. |

### Bag
| ID | Requirement |
| --- | --- |
| B1 | Signed out: the bag is kept in the browser (localStorage) as `{variant_id, quantity}`. |
| B2 | On sign-in, the browser bag merges into the saved bag (quantities add up, capped at stock and 10), then the browser copy is cleared. |
| B3 | Signed in: the bag is saved in Supabase, so it follows the user across devices. |
| B4 | Bag page (`/bag`): items grouped by brand, change quantity, remove, subtotal, delivery hint ("₦x away from free Lagos delivery"), checkout button. |
| B5 | Prices shown in the bag always come from the server. If a price or stock changed, the bag says so. |

### Accounts
| ID | Requirement |
| --- | --- |
| A1 | "Sign in" in the nav and at checkout starts **Continue with Google** (Supabase Auth). After sign-in the user returns to the page they were on. |
| A2 | Signed-in nav shows the user's first initial and a menu: Your orders, Sign out. |
| A3 | A profile row stores name, email, phone and the last delivery address, prefilled at checkout. |

### Checkout and payment
| ID | Requirement |
| --- | --- |
| P1 | `/checkout` as in `design/OjaCheckout.html`. Requires sign-in (step 1 shows "Continue with Google" when signed out). |
| P2 | Delivery form: full name, phone (Nigerian format), street address, area or LGA, state. All required and validated on both browser and server. |
| P3 | Delivery speed and fees follow the **business rules** below; the summary updates live. |
| P4 | "Pay ₦x with Paystack" creates the order on the server (status `pending_payment`), then sends the shopper to Paystack's hosted page. |
| P5 | After Paystack, the shopper lands on `/checkout/complete`, which shows **confirming**, **paid** or **failed** exactly as in `design/OjaConfirming.html`, `OjaConfirmed.html` and `OjaFailed.html`. |
| P6 | Paid means: stock reduced, bag emptied, order visible in "Your orders", email sent. |
| P7 | A failed or abandoned payment leaves the order `pending_payment` and the bag intact; "Try payment again" starts a new Paystack attempt for the same order. |

### Email
| ID | Requirement |
| --- | --- |
| M1 | After an order is paid, send the confirmation email in `design/OjaEmail.html` via Mailgun: greeting, order number, items grouped by brand, totals, delivery address, expected dates, help line. |
| M2 | If sending fails, the order stays paid; the failure is logged and retried on the next verify or webhook call for that order. |
| M3 | Email HTML uses inline styles and table layout so it renders in Gmail and Outlook. Include a plain-text version. |

### Orders
| ID | Requirement |
| --- | --- |
| O1 | "Your orders" (`/orders`): the user's paid orders, newest first, with number, date, total, status. |
| O2 | Order detail (`/orders/:number`): items grouped by brand, totals, delivery details. |

### Trust pages
| ID | Requirement |
| --- | --- |
| T1 | `/privacy`: what we collect (name, email, phone, address, orders), why (to fulfil orders), who processes it (Supabase, Google, Paystack, Mailgun, Vercel), how to ask for deletion. |
| T2 | `/terms`: plain-language shop terms, delivery and a 7-day returns policy on unused items. |
| T3 | A friendly 404 page. |

## Business rules

- **Currency:** NGN only. Amounts in kobo. Display with `Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })`.
- **Delivery (all in kobo in code):**
  - Lagos, Standard (1 to 3 days): free when the subtotal is ₦50,000 or more, otherwise ₦2,500.
  - Lagos, Express (same day if ordered by 12:00 WAT): ₦5,000.
  - Other states, Standard (3 to 5 days): ₦4,500. Express is not available outside Lagos.
- **Quantity:** 1 to 10 per variant, never above stock.
- **Order number:** `OJA-` followed by `10000 + id` (e.g. `OJA-10482`).
- **Paystack reference:** `{order number}-{attempt}` (e.g. `OJA-10482-1`), a new one per attempt.
- **Expected delivery dates** in emails and pages are counted in working days (Mon to Fri) from the payment date.

## Seed catalogue

Six brands, four categories, two edits. Prices in naira here; store them in kobo.
Give every variant a stock between 8 and 25 (a couple at 0 to show sold-out states).

### Brands (kit: accent, text colour, type pairing)
| Brand | Slug | Tagline | City | Kit |
| --- | --- | --- | --- | --- |
| DANFO | `danfo` | Streetwear built for Lagos | Lagos | `#F2B705` / `#111110` / condensed (Big Shoulders Display 900) |
| Elú | `elu` | Modern hand-dyed adire | Abeokuta | `#1E2B55` / `#F4EFE4` / serif (Cormorant Garamond 500) |
| kade | `kade` | Raw shea, whipped soft | Lagos | `#EFE4D2` / `#241A13` / soft serif (Fraunces 400) |
| IVIE | `ivie` | Coral and brass from Benin City | Benin City | `#0E0B09` / `#C9A24A` / didone (Bodoni Moda 400) |
| Kofa | `kofa` | Hand-tooled Kano leather | Kano | `#8A4B24` / `#F6E9D8` / display serif (DM Serif Display) |
| oke | `oke` | Aso-oke, woven in Iseyin | Iseyin | `#1F6F6B` / `#F1F5EF` / grotesk (Space Grotesk 600) |

### Categories
Clothing (`clothing`), Beauty (`beauty`), Jewellery (`jewellery`), Leather & home (`leather-home`).

### Products (variants in brackets)
| Brand | Product | Category | Price |
| --- | --- | --- | --- |
| Danfo | Conductor Jacket (S, M, L, XL, XXL) | Clothing | ₦68,000 |
| Danfo | Oshodi Hoodie (S, M, L, XL, XXL) | Clothing | ₦42,000 |
| Danfo | Third Mainland Tee (S, M, L, XL, XXL) | Clothing | ₦18,500 |
| Danfo | Night Bus Windbreaker (S, M, L, XL, XXL) | Clothing | ₦55,000 |
| Danfo | Molue Cap (One size) | Clothing | ₦12,000 |
| Elú | Olokun Wrap Dress (XS, S, M, L, XL) | Clothing | ₦95,000 |
| Elú | Eleko Shirt (S, M, L, XL) | Clothing | ₦48,000 |
| Elú | Alabere Trousers (XS, S, M, L, XL) | Clothing | ₦56,000 |
| Kade | Whipped Shea Butter (100 ml ₦9,500; 250 ml ₦18,000) | Beauty | from ₦9,500 |
| Kade | Shea and Baobab Oil (50 ml) | Beauty | ₦12,500 |
| Kade | Shea Lip Balm (15 g) | Beauty | ₦3,500 |
| Kade | The Harmattan Kit (One kit) | Beauty | ₦22,000 |
| Ivie | Single-strand coral choker (One size) | Jewellery | ₦85,000 |
| Ivie | Coral drop earrings (10 mm polished ₦38,000; 10 mm aged ₦38,000; 14 mm polished ₦52,000; 14 mm aged ₦52,000) | Jewellery | from ₦38,000 |
| Ivie | Brass hoops, coral tip (One size) | Jewellery | ₦34,000 |
| Ivie | Twisted brass cuff (One size) | Jewellery | ₦46,000 |
| Kofa | Kano leather clutch (Tan, Black) | Leather & home | ₦36,000 |
| Kofa | Leather slides (38 to 45) | Leather & home | ₦28,000 |
| Kofa | Tooled card wallet (Tan) | Leather & home | ₦14,000 |
| Oke | Aso-oke gele (Wine, Indigo, Gold) | Clothing | ₦30,000 |
| Oke | Aso-oke cushion cover (Indigo, Rust) | Leather & home | ₦24,000 |
| Oke | Woven throw (One size) | Leather & home | ₦65,000 |

Write short, specific descriptions for each product in the voice of `TASTE.md`.
No invented certifications, awards or statistics.

### Edits
**The Owambe Edit** (`owambe`, accent `#5E1630`, text `#F6EADC`): "From the church to the reception: five pieces from five Nigerian brands that do the most, without trying too hard."
1. Ivie Single-strand coral choker: "The piece every aunty will ask about. Wear it high, with a bare neckline."
2. Elú Olokun Wrap Dress: "Indigo reads formal without the heat of heavy lace. Wrap it tight for the reception."
3. oke Aso-oke gele, Wine: "Woven on Iseyin looms. Ask your gele artist for the classic fan."
4. Kofa Kano leather clutch, Tan: "Holds your phone, a powder and the envelope for spraying."
5. kade Whipped Shea Butter, 250 ml: "For the glow at 6pm, when the hall lights come on."

**The Harmattan Edit** (`harmattan`, accent `#D9A55B`, text `#2A1D0E`): "Shea, oil, a light jacket and lip balm for the dry, dusty months."
1. kade Whipped Shea Butter, 250 ml: "Twice a day from November. Your elbows will thank you."
2. kade Shea and Baobab Oil: "On damp skin straight after a bath, before the dust gets to it."
3. kade Shea Lip Balm: "One in every bag you own."
4. Danfo Night Bus Windbreaker: "For cold harmattan mornings that turn hot by noon."

## Acceptance criteria

- A signed-out visitor can browse, add from three brands to the bag, sign in with
  Google at checkout, keep their bag, pay with a Paystack test card, and land on
  the paid screen.
- Within a minute they receive the confirmation email (to an authorized Mailgun
  recipient while on the sandbox), and the order appears in "Your orders".
- Stock for each purchased variant drops by exactly the quantity bought, even if
  the webhook and the verify call both arrive.
- Changing a price in the browser, the request or the bag cannot change what
  Paystack charges.
- A webhook with a wrong signature is rejected with 401 and changes nothing.
- Everything works on a 360px phone and a desktop, with the keyboard alone, with
  no console errors.

## Submission checklist

- [ ] Public GitHub repo, `main` deployed at `https://oja-store-seven.vercel.app`
- [ ] Google consent screen published, home page and privacy links set
- [ ] Supabase seeded with the full catalogue
- [ ] One full test purchase on a phone, email received
- [ ] README: what Ọjà is, live link, features, stack, how payments are verified,
      how to run locally, how to test, test card details, Mailgun sandbox note,
      and how AI was used
- [ ] Submitted before 23:59 WAT on Friday
