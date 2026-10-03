# Architecture

## System overview

```
Browser (React + Vite SPA)
  │  Google sign-in and session ──────────────▶ Supabase Auth ──▶ Google OAuth
  │  all data: /api/... with the user's access token (Bearer)
  ▼
Vercel (project oja-store, region lhr1)
  ├── Static SPA (dist/)
  └── Python function: FastAPI (api/index.py)
        ├── verifies tokens with Supabase JWKS (public keys, cached)
        ├── Postgres via Supabase transaction pooler (DATABASE_URL, port 6543)
        ├── Paystack API: initialise and verify transactions
        └── Mailgun API: confirmation emails
Paystack ──webhook (charge.success, signed)──▶ /api/paystack/webhook

Local: Vite :5173 ──proxy /api──▶ uvicorn :8000 ──▶ SQLite oja.db (Supabase Auth still real)
Tests: pytest ──▶ temporary SQLite, Paystack and Mailgun mocked
```

## Key decisions

| Decision | Why |
| --- | --- |
| React + Vite + React Router, plain JavaScript | Same toolchain as Task 1, fast to build; the store needs real pages and URLs. |
| FastAPI + SQLModel on Vercel | Proven in Task 1. Secret keys (Paystack, Mailgun, database) stay on the server. |
| **All data goes through FastAPI**; the browser uses Supabase only for auth, plus Realtime "your bag changed" signals | One place for validation and pricing. Tables are not exposed through Supabase's Data API and RLS is on. The one exception is `bag_items`: a signed-in user may `select` only their own rows (`scripts/sql/realtime_bag_items.sql`) so Realtime can tell their devices the bag changed. Clients never read bag data from Supabase; they re-fetch `GET /api/bag`. |
| Supabase Postgres in production, SQLite locally and in tests | Same SQLModel code, switched by `DATABASE_URL`. Local work and tests never touch real data. Keep SQL portable. |
| Money as integer kobo everywhere | No rounding errors; Paystack also uses kobo. |
| Server-side bag for signed-in users, localStorage for guests | Checkout builds the order from the server bag, never from browser-sent prices. |
| Paystack hosted checkout (redirect) | Card details never touch our site; supports card, transfer and USSD. |
| Paid only after webhook signature or Verify API | Browser redirects can be faked. Both paths call the same idempotent fulfilment. |
| Email after payment, retried if it failed | A failed email must never lose or block an order. |
| Catalogue GET responses cached at Vercel's edge for 60 s | Fast pages and fewer cold starts; catalogue changes rarely. |

## Folder structure

```
.
├── api/
│   ├── __init__.py
│   ├── index.py          FastAPI app, router registration (Vercel entrypoint)
│   ├── config.py         reads environment variables once
│   ├── db.py             engine and sessions (SQLite or Postgres pooler)
│   ├── models.py         SQLModel tables
│   ├── schemas.py        request and response models
│   ├── auth.py           JWKS token verification, current-user dependency
│   ├── pricing.py        delivery fees, totals, order numbers, working-day dates
│   ├── catalogue.py      brands, categories, products, edits (public, cached)
│   ├── bag.py            the guest bag quote now; the signed-in user's bag with auth
│   ├── checkout.py       create order, start Paystack attempt, verify
│   ├── paystack.py       Paystack client and webhook route
│   ├── fulfilment.py     mark_paid(): the single idempotent payment handler
│   ├── mail.py           Mailgun client, email rendering
│   ├── orders.py         the user's orders
│   ├── me.py             the profile
│   ├── nigeria.py        states and phone validation
│   └── emails/
│       ├── order_confirmation.html   inline-styled, table layout
│       └── order_confirmation.txt
├── scripts/
│   ├── init_db.py        create tables and seed (idempotent, upserts by slug)
│   └── seed_data.py      the catalogue from PRD.md
├── tests/                conftest (temp SQLite, fake Paystack/Mailgun, signed test tokens) and one file per router
├── src/
│   ├── main.jsx, App.jsx (routes)
│   ├── lib/  api.js · supabase.js · money.js · dates.js · brandKit.js · variants.js
│   ├── hooks/  useApi.js · usePageTitle.js · useAuth.js · useBag.js
│   ├── components/  Nav, AnnouncementBar, Footer, ProductCard, BrandChip,
│   │                BrandTile, EditTile, Placeholder, VariantPicker,
│   │                QuantityStepper, Button, EmptyState, ErrorState, Loading,
│   │                FilterBar, Layout, Illustrations
│   ├── pages/  Home, Shop, Brands, Brand, Product, Edit, Bag, Checkout,
│   │           CheckoutComplete, Orders, OrderDetail, Privacy, Terms, NotFound
│   └── styles/  tokens.css · base.css · components.css
├── design/               approved mockups (HTML), the visual source of truth
├── public/               favicon, social image
├── index.html, package.json, vite.config.js
├── requirements.txt, requirements-dev.txt, .python-version (3.12)
├── vercel.json, .env.example, .gitignore
└── AGENTS.md, CLAUDE.md, PRD.md, ARCHITECTURE.md, STYLE.md, TASTE.md, README.md
```

## Approved dependencies

Pin exact versions when installing.

- `requirements.txt`: `fastapi`, `sqlmodel`, `psycopg[binary]`, `httpx`, `pyjwt[crypto]`
- `requirements-dev.txt`: `uvicorn[standard]`, `pytest`
- `package.json` dependencies: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`
- `package.json` devDependencies: `vite`, `@vitejs/plugin-react`

## Environment variables

Names match what is set in Vercel. `.env.example` lists them with no values.

| Name | Secret | Used by | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | No | Browser and server | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | No | Browser | `sb_publishable_…` |
| `VITE_CONTACT_EMAIL` | No | Browser | Shown on the privacy and terms pages for deletion and return requests |
| `VITE_PAYSTACK_PUBLIC_KEY` | No | Browser | `pk_test_…` (not needed for redirect checkout; keep for later) |
| `SUPABASE_SECRET_KEY` | **Yes** | Server | Not used by the app yet; reserved for admin scripts |
| `SUPABASE_JWKS_URL` | No | Server | `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` |
| `DATABASE_URL` | **Yes** | Server | Transaction pooler (6543) on Vercel; defaults to `sqlite:///./oja.db` locally |
| `DATABASE_URL_SESSION` | **Yes** | Scripts only | Session pooler (5432). Used by `python -m scripts.init_db --supabase`; never set on Vercel |
| `PAYSTACK_SECRET_KEY` | **Yes** | Server | `sk_test_…`, also the webhook signing key |
| `MAILGUN_API_KEY` | **Yes** | Server | Domain sending key |
| `MAILGUN_DOMAIN` | No | Server | `sandbox….mailgun.org` for now |
| `MAILGUN_API_BASE` | No | Server | `https://api.mailgun.net` (US region) |
| `MAILGUN_FROM` | No | Server | `Oja <orders@sandbox….mailgun.org>` |
| `APP_URL` | No | Server | Production only: `https://oja-store-seven.vercel.app`. Locally `http://localhost:5173` |

Base URL for Paystack callbacks: `APP_URL` if set; otherwise `https://{VERCEL_URL}`
on previews (Vercel system variable).

## Data model

All money columns are integers in kobo. Timestamps are stored and returned in UTC
with a `Z` (reuse Task 1's `UtcDateTime` approach so SQLite matches Postgres).
User ids are Supabase auth user ids (UUID strings).

| Table | Columns |
| --- | --- |
| `brands` | id, slug (unique), name, tagline, descriptor, slogan, story, city, accent, accent_text, type_pairing (`condensed`, `serif`, `soft-serif`, `didone`, `display-serif`, `grotesk`), hero_image_url (nullable), sort_order, is_active |
| `categories` | id, slug (unique), name, sort_order |
| `products` | id, slug (unique), brand_id, category_id, name, description, details, image_urls (JSON list: the 800px card photo, e.g. `/images/products/<slug>.webp`; the product page uses `<slug>-large.webp`), image_alt, is_featured, is_active, created_at |
| `variants` | id, product_id, label, sku (unique), price_kobo, stock (≥ 0), sort_order, is_active |
| `edits` | id, slug (unique), title, kicker, intro, accent, accent_text, sort_order, is_active |
| `edit_items` | id, edit_id, product_id, variant_id (default for "Add all"), position, note |
| `profiles` | user_id (PK), email, full_name, phone, address, area, state, updated_at |
| `bag_items` | id, user_id, variant_id, quantity (1–10), updated_at; unique (user_id, variant_id) |
| `orders` | id, number (unique), user_id, email, status (`pending_payment`, `paid`, `cancelled`), subtotal_kobo, delivery_kobo, total_kobo, delivery_speed (`standard`, `express`), full_name, phone, address, area, state, paystack_reference (unique, latest attempt), payment_attempts, paid_at, email_sent_at, email_error, stock_issue (bool), created_at, updated_at |
| `order_items` | id, order_id, product_id, variant_id, brand_name, product_name, variant_label, unit_price_kobo, quantity, line_total_kobo |
| `payment_events` | id, reference, event, received_at, raw (JSON), for audit and debugging |

Order items copy names and prices at purchase time, so later catalogue edits
never change past orders.

## API contract

Base path `/api`. JSON in snake_case. Money in kobo. Errors use FastAPI's
`{"detail": "..."}`. Signed-in routes need `Authorization: Bearer <access token>`.

### Public (catalogue responses send `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`)
| Method and path | Returns |
| --- | --- |
| `GET /api/health` | `{ok, database}` after a real query |
| `GET /api/brands` | brands with kit fields |
| `GET /api/brands/{slug}` | brand plus its products (404 if missing or inactive) |
| `GET /api/categories` | categories |
| `GET /api/products?category=&brand=&sort=&featured=` | product cards: id, slug, name, brand kit, from-price, image, in_stock |
| `GET /api/products/{slug}` | product with variants (price, stock), brand, the edits it appears in |
| `GET /api/edits` · `GET /api/edits/{slug}` | edits; one edit with ordered items, notes and default variants |
| `POST /api/bag/quote` | body `{items: [{variant_id, quantity}]}` (quantity 1 to 10, at most 50 lines; any price sent is ignored) → `{lines, removed_variant_ids, item_count, subtotal_kobo, free_delivery_remaining_kobo}`. Each line has the server price, `stock`, the `quantity` that can be bought and `issue` (`sold_out`, `reduced` or null) |

### Signed in
| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /api/me` | | profile (created from the token on first call) |
| `PUT /api/me` | name, phone, address fields | profile |
| `GET /api/bag` | | the saved bag as the priced quote (same shape as `POST /api/bag/quote`); items no longer sold are reported once and removed |
| `POST /api/bag/items` | `{variant_id, quantity}` | adds to the quantity already in the bag (one atomic step), capped at stock and 10, and returns the quote. 404 unknown or inactive variant, 409 sold out, 422 bad quantity |
| `PATCH /api/bag/items/{variant_id}` | `{quantity}` | sets the quantity (1 to 10, capped at stock) of a line already in the bag; 404 if the line or variant isn't there; returns the quote |
| `DELETE /api/bag/items/{variant_id}` | | removes the line; safe to repeat; returns the quote |
| `PUT /api/bag` | `{items: [{variant_id, quantity}]}` | replaces the whole bag and returns the priced quote. Kept for compatibility; the website no longer uses it, because a whole-bag write from a stale device would overwrite another device's items. Quantities are clamped to stock and 10; a sold-out item keeps 1 so it still shows, flagged; unknown variants are dropped |
| `POST /api/bag/merge` | `{items: [{variant_id, quantity}]}` | adds a guest bag into the saved one when someone signs in (quantities add up, capped at stock and 10) and returns the quote. Done on the server so two tabs signing in cannot double-count |
| `POST /api/checkout/quote` | `{state, delivery_speed}` | the saved bag with delivery and total from the server rules, plus `delivery_options` (each speed with its fee, or unavailable: express outside Lagos). 422 for an unknown state or an unavailable speed. The checkout page shows these numbers instead of copying the fee rules |
| `POST /api/checkout` | delivery fields + `delivery_speed` + `save_address` | `{order_number, authorization_url, reference}`; 409 if the bag is empty or anything is out of stock; 422 for bad details; 502 if Paystack cannot be reached (the order stays pending) |
| `POST /api/orders/{number}/pay` | | new attempt for an unpaid order: `{authorization_url, reference}` |
| `POST /api/payments/verify` | `{reference}` | `{status: "paid" | "pending" | "failed", order_number}` |
| `GET /api/orders/{number}` | | the order with items, totals, delivery details and, once paid, `arriving_from` and `arriving_to` (404 unknown, 403 someone else's) |
| `GET /api/orders` | | the user's paid orders, newest first (M6) |

### Paystack
| `POST /api/paystack/webhook` | raw body, header `x-paystack-signature` | 200 on valid signature (even if ignored); 401 on bad signature |

## Flows

### Sign-in
1. The browser calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin + returnPath } })`.
2. Supabase handles Google and returns the user with a session. `useAuth` exposes the user and access token.
3. `api.js` adds `Authorization: Bearer <token>` to signed-in requests.
4. `auth.py` verifies the token with `PyJWKClient(SUPABASE_JWKS_URL)` (keys cached for an hour): signature, expiry, `aud == "authenticated"`, issuer `<SUPABASE_URL>/auth/v1`. The user id is `sub`.
5. On sign-in, `lib/bagSync.js` merges the guest bag with `POST /api/bag/merge`. The browser bag then mirrors the saved bag, and every add, set-quantity and remove is sent straight away as its own item call (`POST`, `PATCH`, `DELETE /api/bag/items`), in order, with no whole-bag snapshots. The bag also listens to Supabase Realtime on `bag_items` (INSERT and UPDATE filtered to `user_id`, any DELETE), and on any event, when the tab becomes visible and after a reconnect it re-fetches `GET /api/bag` (debounced about 250 ms, and held back while the shopper's own calls are in flight). The mirror remembers whose it is (`oja.bag.owner`): on later visits it loads `GET /api/bag` instead of merging, and a bag that belongs to someone else is dropped. Signing out empties it.

In M4, confirm the project's JWKS returns keys. If it's empty (legacy shared-secret
signing), switch verification to calling `<SUPABASE_URL>/auth/v1/user` with the
token and tell me.

### Checkout and payment
1. `POST /api/checkout`: in one transaction, read the user's bag, recheck stock
   and prices from `variants`, compute delivery with `pricing.py`, create the
   order (`pending_payment`) and its items, and save the profile address.
2. Initialise Paystack: `POST https://api.paystack.co/transaction/initialize` with
   the user's email, `amount` = total kobo, `currency` = `NGN`, `reference` =
   `{number}-{attempt}`, `callback_url` = `{base}/checkout/complete`, and
   metadata `{order_number, user_id, cancel_action}`, where `cancel_action` is
   `{base}/checkout/complete?reference=…`, so closing Paystack's page also ends on the
   payment screen. Return `authorization_url`.
3. The browser goes to Paystack. Afterwards Paystack redirects to
   `/checkout/complete?reference=…`.
4. `CheckoutComplete` shows **confirming** and calls `POST /api/payments/verify`
   every 3 s for up to 30 s. `verify` asks Paystack
   (`GET /transaction/verify/{reference}`) and, on success, calls `mark_paid`.
5. Separately, Paystack sends `charge.success` to the webhook, which also calls `mark_paid`.
6. The page shows **paid** or **failed** from the response. After 30 s it keeps
   the confirming screen with "Check again" and tells the shopper to email the
   shop's contact address with the order number if they were charged.
7. "Try payment again" calls `POST /api/orders/{number}/pay`: a new attempt
   (`{number}-2`, ...) for the same order.

### `mark_paid(reference, amount, currency)`, the only way an order becomes paid
1. Find the order from the reference: `{number}-{attempt}`, with the attempt between 1 and
   the order's `payment_attempts`. Any past attempt counts, because a payment started on
   attempt 1 can finish after attempt 2 has begun. Unknown reference: log it and return
   (webhooks from previews or local tests reach production too).
2. Reject and log if `amount != total_kobo` or `currency != "NGN"`.
3. Claim it atomically: `UPDATE orders SET status='paid', paid_at=now WHERE id=:id AND status='pending_payment'`.
   If no row changed, it was already paid: skip to step 5.
4. For each item: `UPDATE variants SET stock = stock - :q WHERE id = :v AND stock >= :q`.
   If no row changed, set `orders.stock_issue = true` and log (handled by hand).
   Empty the user's bag. Commit.
5. If `email_sent_at` is null, send the email. On success set `email_sent_at`;
   on failure store `email_error` and log. The next verify or webhook retries.

### Webhook
Read the **raw** request body. Compute `hmac.new(PAYSTACK_SECRET_KEY, body, sha512).hexdigest()`
and compare with `x-paystack-signature` using `hmac.compare_digest`. Wrong: 401.
Right: record a `payment_events` row, handle `charge.success` with `mark_paid`,
and return 200 quickly for every event type.

### Email
`mail.py` renders `order_confirmation.html` and `.txt` with the order (grouped by
brand, totals in naira, delivery details, expected working-day dates) and sends
with `POST {MAILGUN_API_BASE}/v3/{MAILGUN_DOMAIN}/messages` using basic auth
(`api`, `MAILGUN_API_KEY`), `from` = `MAILGUN_FROM`, `to` = order email. While on
the sandbox, only authorized recipients receive it. `MAILGUN_FROM` must include an
address, like `Oja <orders@sandbox….mailgun.org>`; one without an `@` is rejected by Mailgun.

The send is claimed first: `UPDATE orders SET email_sent_at = now WHERE id = :id AND
email_sent_at IS NULL`. Only the caller that changed a row sends, so two callers at once
(webhook and verify) cannot both send. If the send fails, `email_sent_at` is cleared and the
reason is kept in `email_error`, and the next verify or webhook for that order tries again.
A failed email never changes the order or the answer to the webhook or verify call. The email
is sent during that request, with a 10 s timeout, because serverless can stop background work
once the response is sent. The HTML and text templates are read from `api/emails/`, which
`vercel.json` lists under `includeFiles` so they are deployed with the function.
The email uses system fonts and inline styles, because web fonts and stylesheets do not load in
most mail clients.

## Database connection

- `db.py` rewrites `postgres://` and `postgresql://` to `postgresql+psycopg://`.
- The transaction pooler does not support prepared statements: pass
  `connect_args={"prepare_threshold": None}` for Postgres.
- Use `NullPool` on Vercel (each function call opens and closes one pooled
  connection) and `pool_pre_ping=True`.
- SQLite: `check_same_thread=False`. Keep queries portable (no Postgres-only SQL).
- `scripts/init_db.py` runs `create_all` and upserts the seed by slug and sku, so
  it's safe to run twice. Automatic RLS is enabled on the Supabase project, so new
  tables are locked by default.

## Deployment on Vercel

- One project at the repo root, Vite preset, output `dist/`. Python function at
  `api/index.py`. `.python-version` pins 3.12.
- `vercel.json` (check Vercel's current docs, then prove it on the M0 preview):

```json
{
  "regions": ["lhr1"],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

  Static files are served before rewrites, so the second rule only catches SPA routes.
- Previews and production share the Supabase database. Don't seed or test
  destructively on previews.
- FastAPI's interactive pages (`/docs`, `/redoc`, `/openapi.json`) are switched off on Vercel
  (`create_app(public_docs=False)` when `VERCEL` is set) and on locally.
- Paystack's webhook URL points at production only. Previews and localhost rely
  on the verify call, which works everywhere.

## Performance

- Catalogue endpoints cached at the edge (see API contract).
- Product lists return only card fields; product pages load the rest.
- The browser shows the cached bag instantly and refreshes it from the server.
- Fonts: one `<link>` with `display=swap`, only the weights `TASTE.md` lists.
- Images (when added) are served from Supabase Storage in WebP, sized for their slot.

## Known risks

| Risk | Plan |
| --- | --- |
| Vercel routing for SPA plus Python | Prove in M0 with `/api/health` and a deep link like `/brands/danfo` |
| JWKS not returning keys | Check in M4; fallback described above |
| Webhook not reaching production | Verify-on-return covers it; check Paystack's webhook log |
| Mailgun sandbox recipients | Test with authorized addresses; README explains; screenshot of a real email |
| Cold starts after idle | Edge caching, a friendly loading state, `GET /api/health` warm-up on first load |

## Mobile app (`mobile/`, Task 3)

- Expo SDK 57 (pinned for Expo Go 57.0.9), React Native, expo-router, TypeScript. Own `package.json`; `mobile/` is in `.vercelignore` so the website build ignores it.
- It talks to the **production API** with the same Bearer token as the website (`src/lib/api.ts`) and uses Supabase only for Google sign-in and the session (`src/lib/supabase.ts`, PKCE, AsyncStorage). Public env values only, in `mobile/.env` (see `.env.example`).
- Sign-in (`src/lib/auth.tsx`): `signInWithOAuth` with `skipBrowserRedirect`, then `WebBrowser.openAuthSessionAsync` (Chrome Custom Tabs, never a WebView: Google blocks those), then `exchangeCodeForSession`. Supabase is given `redirectTo = https://<site>/app-callback?to=<app address>`, an https address Supabase always accepts. That page (`public/app-callback.html`, a static page served by a `vercel.json` rewrite) forwards the code to the app address in `to`: `exp://<private network address>/--/auth-callback` in Expo Go, `oja://auth-callback` in the installed app (`makeRedirectUri({ scheme: 'oja', path: 'auth-callback' })`). It forwards only to those two shapes, drops every other parameter, and never logs, stores or sends the code. The app's `auth-callback` route and `openAuthSessionAsync` both hand the code to one function that exchanges it once. After sign-in the app calls `GET /api/me`.
- Sign-out is `scope: 'local'`: it signs out this device only.
- `user_id` and the redirect URL are shown on the Account screen in development builds only.
- Screens (T2): Shop tab (home: hero, brand tiles, edits, new in), `/shop` (category and brand filters), `/brand/[slug]`, `/product/[slug]` (gallery, variant picker, add to bag via `POST /api/bag/items`), `/edit/[slug]` (read only). Data comes from the same catalogue endpoints as the website through `src/lib/useApi.ts` (in-memory cache, 60 s). Each brand's chip and tile use its own typeface (one weight per `@expo-google-fonts/*` package) and colours from `src/lib/brandKit.ts`, mirroring the website's `kit-*` classes. The website's drawn brand heroes are not reproduced; the app shows the brand colour block and name.
- `mobile/metro.config.js` blocks the website's root `node_modules`, so Metro can only resolve packages from `mobile/node_modules` (a second copy of react would crash the app). Every dependency the app needs must therefore be installed in `mobile/`.
