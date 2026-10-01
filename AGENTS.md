# AGENTS.md

Instructions for AI coding agents (Claude Code) working in this repository.

## The project in one paragraph

Ọjà ("market" in Yoruba) is a curated online store for made-in-Nigeria brands,
built for HNG Internship 15, Task 2. Shoppers browse six independent brands and
themed **edits**, fill one bag, sign in with Google, and pay once with
**Paystack**. The order is saved in **Supabase** (Postgres) and a confirmation
email is sent through **Mailgun**. It must be a real, usable shop, not a demo.

- Live URL: `https://oja-store-seven.vercel.app`
- Repo: `TwajiesHub/oja-store` (Vercel project `oja-store`, region London `lhr1`)
- Deadline: **Friday 2 Oct 2026**. Feature cutoff **Friday 15:00 WAT**. Submit by 20:00 WAT.

## Read these before working

| File | Read it |
| --- | --- |
| `PRD.md` | Before any task. What to build, business rules, seed catalogue, acceptance criteria. |
| `ARCHITECTURE.md` | Before writing code. Structure, data model, API contract, payment and email flows, deployment. |
| `STYLE.md` | Before writing code. Code conventions. |
| `TASTE.md` | Before any UI work. Look, feel, copy and the brand-kit rules. |
| `design/*.html` | Before building a screen. These are the approved mockups. Match them. |

If the docs conflict, `PRD.md` wins on *what* to build, `ARCHITECTURE.md` on
*how*, and `design/` on *how it looks*. If a decision changes, update the doc in
the same change.

## Working with me

- I know Python and some Django. I'm newer to React and FastAPI. After each step,
  explain what you did in short, plain language.
- Before each milestone, give a short plan and list the decisions you're making
  with the default you picked. Wait for my OK.
- If you need a decision the docs don't cover, ask one clear question with your
  recommendation.
- Don't hide problems. If a command fails, a test is flaky or a design detail
  can't be matched, say so.

## Rules (non-negotiable)

### Money and payments
1. **Money is always an integer number of kobo** (₦1 = 100 kobo), in the
   database, the API and the code. Never floats. Format to naira only for display.
2. **Never trust the browser for prices, totals or stock.** Checkout builds the
   order from the database: the server-side cart, current variant prices and the
   delivery rules in `PRD.md`.
3. **An order is only "paid" after the server has confirmed it with Paystack**,
   through a webhook with a valid signature or through the Verify Transaction
   API. A browser redirect or a query string proves nothing.
4. **Payment fulfilment is idempotent.** Processing the same successful payment
   twice (webhook plus verify, or a repeated webhook) must not decrement stock
   twice, create duplicates or send two emails.
5. Check the **amount and currency** Paystack reports against the order total
   before marking it paid.
6. Use **Paystack test keys only**. Never put live keys in any environment.

### Secrets and security
7. **Nothing secret ever gets a `VITE_` prefix.** Anything prefixed `VITE_` is
   shipped to every visitor's browser.
8. Never commit `.env`, keys, connection strings, `*.db`, `.venv/`,
   `node_modules/` or `dist/`. Keep `.gitignore` and `.env.example` up to date
   (names only, no values).
9. The browser talks to our FastAPI backend (`/api/...`) for all data. It uses
   Supabase directly **only for Google sign-in and the session**. Tables are not
   exposed through Supabase's Data API, and Row Level Security stays on.
10. Every endpoint that touches a user's data verifies the Supabase access token
    and only ever reads or writes that user's rows.

### Tests and scope
11. Every endpoint gets tests in the same change: success plus each error case
    (401, 403, 404, 409, 422 as they apply).
12. Tests run against a temporary SQLite database with **Paystack and Mailgun
    mocked**. Tests never call real services and never touch Supabase.
13. Never delete, skip or weaken a failing test to make it pass. Fix the code or
    stop and tell me.
14. Use only the dependencies listed in `ARCHITECTURE.md`. Ask before adding any other.
15. Stay in scope. Anything in the PRD's "Out of scope" list needs my explicit OK.
16. `main` must always deploy and work. Build on a branch and merge only when the
    Definition of Done is met.

## Commands (Windows PowerShell)

Backend, from the repo root:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
python -m scripts.init_db        # create tables and seed the catalogue (local SQLite by default)
uvicorn api.index:app --reload --port 8000
pytest
```

Frontend, from the repo root, in a second terminal:

```powershell
npm install
npm run dev      # http://localhost:5173, /api is proxied to :8000
npm run build
```

Seeding Supabase (only when I ask): set `DATABASE_URL` to the **session pooler**
string (port 5432) in the terminal, then run `python -m scripts.init_db`.

## Milestones and branches

| # | Branch | Goal | Target |
| --- | --- | --- | --- |
| M0 | `setup` | Vite + React + FastAPI skeleton deployed; `GET /api/health` reads Supabase on the preview. Tables created and catalogue seeded in Supabase. | Wed night |
| M1 | `catalogue` | Home, shop (filters), brand pages, product pages from the seeded catalogue, matching `design/`. | Thu morning |
| M2 | `edits` | Edit pages with curator notes and "Add all to bag". | Thu midday |
| M3 | `bag` | Guest bag in the browser, bag page, synced to the database once signed in. | Thu afternoon |
| M4 | `auth` | Google sign-in via Supabase, token verification on the backend, profiles. | Thu evening |
| M5 | `checkout` | Checkout page, order creation, Paystack initialise, callback page states, webhook and verify, stock. | Fri morning |
| M6 | `email` | Mailgun confirmation email after payment; "Your orders" pages. | Fri midday |
| M7 | `polish` | Privacy and terms pages, 404, empty and error states, mobile pass, README. | Fri afternoon |

Merge each milestone before starting the next. If time runs short, cut from the
bottom of M7, never from payments (M5) or email (M6).

## Definition of done (every milestone)

- [ ] `pytest` passes with no skipped tests
- [ ] `npm run build` succeeds with no errors
- [ ] You ran the app and checked the feature in a browser at 360px and desktop widths
- [ ] Screens match the relevant `design/*.html` mockup (layout, type, colour, copy)
- [ ] The Vercel preview for the branch works (I check it, since previews need my login)
- [ ] No secrets or local files are staged
- [ ] Docs updated if any decision changed
- [ ] A short, plain-language summary for me of what changed
