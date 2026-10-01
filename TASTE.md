# Taste

How Ọjà looks, feels and reads. The mockups in `design/` are the source of truth;
this file explains the rules behind them so new screens stay consistent.

## The idea

Ọjà is a market reimagined as a magazine. The store itself is calm and
typographic, black, off-white and stone, so that **each brand's colour is the
only colour in its space**. Big, confident type does the work that imagery will
do once real photos arrive.

## Principles

1. **The frame recedes, the brands speak.** Store chrome never borrows a brand's colour.
2. **Editorial, not template.** Huge headlines, generous space, asymmetric layouts,
   small monospace labels. Every section should look art-directed.
3. **Trust at checkout.** Checkout and payment screens get calmer, plainer and
   more explicit, never louder.
4. **Phone first.** Most shoppers are on phones and mobile data.
5. **Honest states.** Show what is happening (confirming, paid, failed, sold out)
   in plain words.

## Store palette (tokens)

| Token | Hex | Use |
| --- | --- | --- |
| `--paper` | `#F4F1EA` | Page background |
| `--ink` | `#121110` | Text, primary buttons, announcement bar, footer |
| `--stone` | `#E4DED2` | Product image slots, summary panels |
| `--stone-dark` | `#D8D1C3` | Cover story slot, thumbnails |
| `--line` | `#CFC8BB` | Hairlines and borders |
| `--mute` | `#6A645B` | Secondary text, labels |
| `--field` | `#FBFAF6` | Input backgrounds |
| `--ok` | `#1F6F6B` | Paid, success |
| `--error` | `#9E2B2B` | Payment failed, form errors |

No gradients, no drop shadows, no purple, no emoji in the interface.

## Type

| Role | Font | Settings |
| --- | --- | --- |
| Wordmark | Archivo | weight 900, width 125%, tracking -0.03em |
| Display headings | Archivo | weight 800, width 112%, tracking -0.04em, line height 0.92 |
| Editorial accent | Playfair Display italic | weight 400, used for the second half of headlines and edit titles |
| Body and UI | Archivo | weights 400 to 700, normal width |
| Labels, prices, buttons | JetBrains Mono | 11 to 14px, uppercase for labels and buttons, tracking 0.1em |

Load them in one Google Fonts link with `display=swap`:
`Archivo:wdth,wght@62..125,400..900`, `Playfair Display:ital,wght@1,400`,
`JetBrains Mono:wght@400;500`, plus the brand-kit fonts below.
All must support the Vietnamese subset so "Ọjà" renders correctly.

Scale on desktop: hero 124px, section headings 80px, category rows 104px,
product names 17px, body 16 to 19px. Phones roughly halve display sizes.
Headings are sentence case. Labels are uppercase mono.

## The brand kit

Every brand provides: **accent** (background colour), **accent_text** (text
colour on it), **type_pairing**, tagline, city and story. The template does the rest.

| type_pairing | Font for the brand's name and headings |
| --- | --- |
| `condensed` | Big Shoulders Display 900, uppercase, tracking 0.04em |
| `serif` | Cormorant Garamond 500 |
| `soft-serif` | Fraunces 400, lowercase wordmark, tracking -0.03em |
| `didone` | Bodoni Moda 400, uppercase, tracking 0.3em |
| `display-serif` | DM Serif Display 400 |
| `grotesk` | Space Grotesk 600, lowercase |

Where the kit appears, and only there:
- **Brand tile** (home, brands index, "more brands"): solid accent, name in the kit font.
- **Brand chip** (on product cards, edit items, bag and checkout lines): small
  solid label in the kit colours and font.
- **Brand block** on the brand page: the hero area and the "about the brand"
  accent. Everything else on the page stays in the store frame.
- **Placeholder** product images: when a product has no photo, fill the slot with
  the stone colour, the brand chip and the product name in small mono. Never a
  broken image or a grey box with an icon.

Guardrails: check `accent_text` on `accent` meets WCAG AA. Light accents (like
Kade's cream) get a 1px `--line` inset border so they don't dissolve into the page.

## Edits

An edit has an **accent** and **accent_text** and uses the same rules as a brand
kit, with the title always in Playfair Display italic.
- Owambe: `#5E1630` on `#F6EADC`, with the coral-bead strand graphic.
- Harmattan: `#D9A55B` on `#2A1D0E`, with the pale concentric "sun haze" graphic.
Edit items alternate image left and right, numbered `01`, `02`, with the curator's
note in italic quotes.

## Components

- **Announcement bar:** 36px, ink, mono uppercase.
- **Nav:** wordmark left, category links centre, Sign in and a solid ink
  "Bag (n)" right. On phones: menu button, centred wordmark, bag.
- **Buttons:** primary is solid ink with paper mono uppercase text, 54 to 64px
  tall. Secondary is a 1px ink outline. Text links use a 1.5px underline offset below.
  Arrows (↗) mark links that go somewhere new.
- **Product card:** stone image slot (430px tall desktop, 220px phone), brand
  chip top-left, name in 17px semibold, price in mono on the same row, one line of
  meta underneath. No borders, no shadows.
- **Category rows:** full-width rows with a hairline above, huge display word
  left, brands in mono and ↗ on the right.
- **Forms:** visible labels above fields, 50px inputs on `--field`, 1px
  `#BDB5A6` border, ink border on focus.
- **Selected states** (variant, delivery speed): ink border and fill or ink text;
  never colour alone.
- **Checkout summary:** stone panel, lines grouped under brand chips, totals in mono.

## Motion

Only where it carries meaning: bag count updating, a variant being selected,
page content fading in (150ms). No parallax, no scroll-jacking, no carousels
that move by themselves. Respect `prefers-reduced-motion`.

## Copy

Plain, warm, specific, Nigerian English. Sentence case. Active verbs. Short.

| Where | Text |
| --- | --- |
| Hero | The best of made‑in‑Nigeria, *in one market.* |
| Add to bag | ADD TO BAG · ₦18,000 |
| Added | ADDED TO BAG ✓ |
| Sold out variant | Sold out |
| Free delivery hint | You're ₦12,000 away from free Lagos delivery. |
| Pay button | PAY ₦116,000 WITH PAYSTACK ↗ |
| Confirming | Confirming your *payment…* |
| Paid | Payment received. *Thank you, Amina.* |
| Failed | Payment didn't *go through.* No money was taken. |
| Empty bag | Your bag is empty. Start with the brands, or an edit. |
| Load error | We couldn't load this right now. Check your connection and try again. |

Errors say what happened and what to do, without apologising. No "successfully",
no exclamation marks. Prices always show the naira sign and thousands separators.

## Imagery

- Until real photos arrive, use the placeholder rule above; the layout must look
  finished without photos.
- When photos arrive: consistent art direction per brand (same light, same
  backgrounds), people and places in Nigeria, 4:5 product crops.
- Illustrations drawn in code (the danfo bus, coral beads, the sun haze) are welcome
  inside brand and edit blocks.

## Avoid

Cards with shadows, gradients, rounded "app" corners on everything, stock icons
in circles, carousels, pop-ups, cookie-banner-style modals, countdown timers,
fake urgency ("only 2 left!" unless it's true), badges and confetti.

## Quality floor

- 360px and 1440px with no sideways scroll; tap targets at least 44px
- Keyboard-only use with visible focus
- AA contrast in the store frame and in every brand kit and edit
- Loading, empty, error and sold-out states designed for every page
- "Ọjà" renders with its diacritics everywhere it appears
