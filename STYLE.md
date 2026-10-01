# Style

Code a beginner can read and explain. Clear over clever.

## General

- Small functions that do one thing, named for what they do.
- Comments explain **why**. No dead code, no stray `print` or `console.log`.
- Name every constant: `FREE_DELIVERY_THRESHOLD_KOBO = 5_000_000`,
  `EXPRESS_FEE_KOBO = 500_000`, `MAX_QUANTITY = 10`, `VERIFY_POLL_MS = 3000`.
- Split a file when it passes about 250 lines.

## Money

- Money variables and columns end in `_kobo` and are integers.
- Convert to naira **only** for display: Python `format_naira(kobo)` in
  `pricing.py`, JavaScript `formatNaira(kobo)` in `src/lib/money.js`
  (`Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })`).
- Never do arithmetic on formatted strings or floats.

## Python (backend)

- PEP 8, type hints on every function signature, f-strings.
- Request and response bodies are Pydantic/SQLModel models in `schemas.py`.
  Validate at the edge: trimming, lengths, phone format, allowed states.
- Route handlers stay short: parse, call a function, return. Business logic lives
  in `pricing.py`, `fulfilment.py`, `mail.py`.
- External calls (Paystack, Mailgun) go through one small client function each,
  using `httpx` with a timeout (10 s). Tests replace these functions.
- Raise `HTTPException` with a clear `detail`: `"Order OJA-10482 not found"`,
  `"Oshodi Hoodie (M) has only 2 left"`.
- Log payment and email events with the order number and reference, never with
  keys, tokens or full card data.
- Read environment variables only in `config.py`.

## Tests

- `pytest`, files `test_<area>.py`, tests `test_<what>_<condition>`, for example
  `test_webhook_rejects_bad_signature`, `test_mark_paid_is_idempotent`.
- Arrange, act, assert. Each test starts from an empty temporary database.
- Must-have cases: price tampering has no effect; stock never goes negative;
  `mark_paid` twice decrements once and emails once; amount mismatch is rejected;
  wrong webhook signature is 401; another user's order is 403; out-of-stock
  checkout is 409; delivery fees for every rule in the PRD.
- Auth in tests: sign tokens with a test key pair and point the verifier at it.

## JavaScript and React (frontend)

- Function components and hooks. One component per file, `PascalCase`.
- Components never call `fetch` or Supabase directly: use `src/lib/api.js`
  and `src/lib/supabase.js` through `useAuth` and `useBag`.
- Pages fetch their data; components mostly render.
- Every page handles loading, empty and error states.
- Links are real `<Link>`s, buttons are real `<button>`s.
- Route params and filters live in the URL, so pages can be shared and refreshed.

## CSS

- `src/styles/tokens.css` holds the design tokens from `TASTE.md` as CSS variables.
- Brand and edit colours arrive as data and are applied with CSS variables on the
  element: `style={{ '--kit-bg': brand.accent, '--kit-fg': brand.accent_text }}`.
- `kebab-case` class names for what things are: `.product-card`, `.brand-tile`, `.edit-hero`.
- Mobile first: base styles for 360px, then `min-width` media queries at 768px and 1200px.
- No CSS framework, no inline styles except CSS variables and computed values.

## Accessibility

- Every input has a visible label. Icon-only buttons have an `aria-label`.
- Everything works by keyboard with a visible focus ring.
- Colour is never the only signal (stock, errors, selected variants).
- Respect `prefers-reduced-motion`.
- Check contrast for each brand kit and edit accent; if text fails AA, use the
  kit's text colour on a solid block instead of on imagery.

## Git

- Branch per milestone (`setup`, `catalogue`, `edits`, `bag`, `auth`, `checkout`,
  `email`, `polish`). Small commits with imperative messages:
  `Add Paystack webhook signature check`.
- Run `pytest` and `npm run build` before every push.
