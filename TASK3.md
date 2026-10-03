# TASK3.md: Ọjà mobile app (HNG15, Lesson 3)

Read this after `AGENTS.md`. It extends the existing docs for Task 3. As each
milestone lands, fold the relevant parts into `PRD.md`, `ARCHITECTURE.md`,
`AGENTS.md` and `TASTE.md` so they stay the single source of truth.

## The brief

> Create a mobile app for your existing shop website using the same API endpoints.
> Users must be able to log in to both the website and mobile app using the same
> account. When a user adds an item to their cart on the website, it must
> instantly appear in their cart on the mobile app. Test the mobile app on a
> physical phone to confirm that login and cart synchronisation work correctly.

- Deadline: **Monday 5 Oct 2026, 23:59 WAT**. Feature cutoff **Monday 15:00 WAT**.
- Test phone: **Android**, with **Expo Go 57.0.9 (supports SDK 57 only)**. Auto-updates
  for Expo Go are switched off on the phone.
- Supabase redirect URLs already include `exp://**` (Expo Go testing) and `oja://**`
  (installed app).

## Acceptance criteria

1. Signing in with the same Google account on the website and the app shows the
   same user (`GET /api/me` returns the same `user_id` on both).
2. Adding an item on the website makes it appear in the app's bag **within about
   2 seconds**, without touching the app. The same works in reverse.
3. Changing a quantity or removing an item on either side shows on the other.
4. Two devices editing at once never lose an item (no whole-bag overwrites).
5. After the app has been in the background, coming back shows the current bag.
6. Signing out on one device doesn't sign out the other, and the app's bag clears
   on sign-out.
7. All of the above verified on a physical Android phone, first in Expo Go, then
   in the installed APK.

## Scope

**Must:** Google sign-in and sign-out; home (brands, edits, new in); brand page;
product page with variant picker and add to bag; bag screen with live sync,
quantity, remove and subtotal; the Ọjà look.

**Should:** shop list with category and brand filters; edit pages; "Your orders" (read only).

**Could:** checkout inside the app. Default instead: the bag's **Checkout** button
opens the website's `/bag` in the phone's browser with the note "You'll finish
checkout on the website". Because the bag is synced, the same items are there.

**Out:** push notifications, offline mode, iOS build, app store publishing.

## Architecture

```
Android app (Expo SDK 57, React Native, expo-router)
  ├── Supabase Auth (Google, PKCE, deep link back to the app)   same project as the web
  ├── REST: https://oja-store-seven.vercel.app/api/...           same FastAPI endpoints, Bearer token
  └── Supabase Realtime: bag_items changes for this user         triggers a re-fetch of GET /api/bag
Website: same item-level bag endpoints + the same Realtime subscription
```

- The app uses the **production API**. Vercel previews sit behind Vercel login,
  which a phone app can't pass. So **backend changes must be merged to `main`
  before the app depends on them**, and they must be additive (nothing the live
  website uses may break).
- The API stays the single source of truth for prices and stock. Realtime only
  says "your bag changed"; both clients then re-fetch `GET /api/bag`.

### Backend changes (milestone T0)

1. **Item-level bag endpoints**, all signed-in, all returning the same priced bag
   shape as `GET /api/bag`:
   - `POST /api/bag/items` `{variant_id, quantity}`: adds to the existing quantity
     (atomic increment), clamped to stock and 10. 422 for bad input, 404 for an
     unknown or inactive variant.
   - `PATCH /api/bag/items/{variant_id}` `{quantity}`: sets the quantity (1 to 10,
     clamped to stock).
   - `DELETE /api/bag/items/{variant_id}`: removes the line.
   - Keep `GET /api/bag`, `POST /api/bag/merge` and `PUT /api/bag` working.
     The website switches to the item endpoints; `PUT` stays for compatibility.
   - Tests: success, 401, 404, 422, clamping, cross-user isolation, and two
     concurrent adds of the same variant ending with the correct total.
2. **Realtime on `bag_items`** (a Supabase SQL migration, applied with my OK):
   - Add `bag_items` to the `supabase_realtime` publication.
   - `GRANT SELECT ON public.bag_items TO authenticated;` (tables aren't
     auto-exposed in this project).
   - An RLS policy letting a signed-in user select **only their own** rows:
     `using (auth.uid()::text = user_id)`. Check the column type and cast to match.
   - Note: Realtime can't filter DELETE events by row. Clients should treat any
     delete event on the channel as "re-fetch my bag" (cheap and harmless),
     and filter INSERT and UPDATE by `user_id=eq.<my id>`.
3. **The website:** use the item endpoints for signed-in users, subscribe to
   Realtime for the signed-in user's bag, and re-fetch on events (debounced
   about 250 ms) and when the tab becomes visible. The guest bag is unchanged.

### Mobile app

- Lives in `mobile/` in this repo, with its own `package.json`. Add a
  `.vercelignore` entry for `mobile/` so the website's Vercel build ignores it.
- **Expo SDK 57 exactly**, pinned, so it opens in Expo Go 57.0.9. Don't upgrade.
- `app.json`: name "Ọjà", slug `oja`, scheme `oja`, Android package
  `com.twajieshub.oja`, the Ọjà icon and splash on paper `#F4F1EA`.
- Approved dependencies (installed with `npx expo install` so versions match SDK 57):
  `expo-router`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `react-native-url-polyfill`, `expo-web-browser`, `expo-auth-session`,
  `expo-linking`, `expo-font`, `expo-image`, `expo-constants`,
  `@expo-google-fonts/archivo`, `@expo-google-fonts/playfair-display`,
  `@expo-google-fonts/jetbrains-mono`. Ask before adding anything else.
- Environment (public values only, in `mobile/.env`, gitignored, plus an
  `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `EXPO_PUBLIC_API_URL=https://oja-store-seven.vercel.app`. **No secret keys in
  the app, ever**: anything in an app can be extracted from the APK.

### Sign-in flow (the riskiest part: build it first)

1. Supabase client with AsyncStorage session storage, `flowType: 'pkce'`,
   `detectSessionInUrl: false`, auto-refresh started and stopped with app state.
2. `redirectTo = makeRedirectUri({ scheme: 'oja', path: 'auth-callback' })`.
   In Expo Go this is an `exp://…/--/auth-callback` address; in the APK it's
   `oja://auth-callback`. Both are allowed in Supabase.
3. `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`,
   then `WebBrowser.openAuthSessionAsync(url, redirectTo)`.
4. Read the `code` from the returned URL and call `exchangeCodeForSession(code)`.
5. Call `GET /api/me` with the access token to prove the same account works on
   the backend. Log the resolved `redirectTo` in development to debug mismatches.

### Bag sync in the app

- On sign-in: merge nothing (the app has no guest bag in v1), load `GET /api/bag`.
- Subscribe to the Realtime channel for this user's `bag_items`; on any event,
  debounce about 250 ms, then re-fetch `GET /api/bag`.
- Re-fetch when the app returns to the foreground (`AppState` "active") and
  after the Realtime channel reconnects.
- Changes use the item endpoints with optimistic UI and rollback on error.
- Unsubscribe and clear the bag on sign-out.

## Design

The same Ọjà system as `TASTE.md`, adapted for a phone:
- Tokens: paper `#F4F1EA`, ink `#121110`, stone `#E4DED2`, line `#CFC8BB`,
  mute `#665F56`. Archivo (display weights), Playfair Display italic for
  editorial accents, JetBrains Mono for labels and prices.
- Bottom tabs: **Shop**, **Bag** (with a count badge), **Account**.
- Product cards two per row, with the product photos from the API (prefix
  relative paths with `EXPO_PUBLIC_API_URL`), brand chips in each brand's kit,
  and the same placeholder for products without photos.
- 48 dp minimum touch targets, safe areas respected, Android back button works
  everywhere, no layout overflow on a 360 dp-wide phone.
- The live-sync moment should feel deliberate: when the bag updates from another
  device, briefly highlight the changed line.

## Testing on the phone

- Run with `npx expo start` in `mobile/`; scan the QR code with Expo Go on the
  same Wi-Fi. If it won't connect, use `npx expo start --tunnel`.
- Sync test script (do it every milestone that touches the bag):
  website and phone signed in with the same account, side by side; add on the
  website, watch the phone; change quantity on the phone, watch the website;
  remove on each side; background the app, change the bag on the website,
  reopen the app.

## Installable APK (milestone T4)

- `eas init` links the app to my Expo account (slug `oja`), then an EAS build
  profile `preview` with `android.buildType: "apk"`. Let EAS generate the keystore.
- Builds can queue on the free tier: start the first one by Sunday evening.
- Install the APK on the phone, repeat the full sync test, then I remove
  `exp://**` from Supabase's redirect URLs.

## Milestones

| # | Branch | Goal | Target |
| --- | --- | --- | --- |
| T0 | `bag-sync-api` | Item bag endpoints with tests, Realtime migration, the website switched over and subscribed. Merged to `main` and live. | Sat |
| T1 | `mobile-skeleton` | Expo SDK 57 app in `mobile/`, fonts, tabs, Google sign-in working in Expo Go on my phone, `/api/me` returns my account. | Sat night |
| T2 | `mobile-catalogue` | Home, brand, product (and shop list if time) using the API. | Sun |
| T3 | `mobile-bag` | Bag screen with live sync both ways, passing the sync test on the phone. | Sun |
| T4 | `mobile-apk` | EAS APK built, installed, sync test passed on the installed app. | Sun night |
| T5 | `mobile-polish` | Edits and orders if time, README mobile section (APK link, how to test, a short sync demo video), submission. | Mon by 15:00 |

Rules from `AGENTS.md` still apply: plan first and wait for my OK, tests with every
endpoint, never print secrets, I merge to `main` myself, and you stop before merging.
