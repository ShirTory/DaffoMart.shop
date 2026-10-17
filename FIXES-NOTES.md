# Daffomart – analysis & bug-fix pass

Checked: `npm ci`, `tsc --noEmit` (0 errors), `next build` (passes), plus a live smoke test of checkout → online pay → track → cancel → rider GPS.

## Bugs fixed
1. **Payment callback was unsafe** (`api/payments/online/callback`)
   - it could mark *any* order (even COD) as paid/failed → now only `payment === "online"` orders
   - a later "fail" callback could flip an already-paid order back to `failed` → paid orders are now never changed again
   - redirect URL now URL-encodes order no. / phone
2. **"Pay now" button was missing on the Track page** – checkout says "retry from the Track page" but no button existed (`payNow()` was dead code). Added, for unpaid online orders.
3. **Service charge could never be saved** – field was missing from `settingsSchema` (zod stripped it) and from the admin Settings UI. Added both. (Backend + checkout + track already supported it.)
4. **Overselling race in `createOrder`** – stock is now re-read right before the order is saved, and the order is written only after stock checks pass.
5. **Reorder created broken product links** – Track/My-orders reorder stored the product *id* as `slug` → `/products/<id>` = 404. Cart sync now refreshes the real slug.
6. **Rider GPS wrote the whole rider record from a stale copy** (could overwrite an admin edit/deactivation) → now `db.update` with only lat/lng/locAt. Same in rider logout.
7. **Rider login timing leak** – unknown phone skipped password hashing; now always hashes.
8. **Rider sign-out left "share location" ON** in localStorage → next login auto-started GPS. Now cleared.
9. **Phone formats** – `+8801712…`, `8801712…`, spaces/dashes now work in Track, Cancel, My orders and Pay-init (new `normPhone` helper).

## Not changed (your decision) – recommendations
- `/api/orders/my?phone=` returns order numbers for any phone number, which weakens the "order no. + phone" check used by Track/Cancel. Consider an OTP, or return less data.
- `npm audit` flags `sharp`, `postcss` (build-time) – run `npm audit fix` and re-test when convenient.
- In-memory rate-limiter resets per serverless instance (fine as a basic guard, not strict).
- Stock decrement is still read-modify-write; for heavy traffic use a Firestore transaction.
- `/api/health` is public and shows which env vars are set (booleans only). Fine for debugging; remove or protect later.
- Set `PAYMENT_TEST_MODE` to `false`/unset on the live site – the sandbox gateway lets anyone "pay" for free.
- Google `Marker` is deprecated (still works); migrate to `AdvancedMarkerElement` later.

---

# Round 2 – requirements audit & new modules

## Why so many things were "missing" in the admin panel (root causes)
1. **Theme settings were dummy controls.** Admin saved `primaryColor`, `buttonRadius`, `buttonSize`… and the layout wrote CSS variables, but Tailwind used fixed hex colours and nothing read the variables. Now Tailwind colours and `.btn*` classes read the variables (`src/lib/theme.ts`, `globals.css`, `tailwind.config.ts`).
2. **Old seed defaults were rose/amber** (not the logo's blue/orange). They are now ignored automatically (`getSettings`), so turning the theme on does not recolour your live site.
3. **Footer promo image existed in the database schema only** – no admin field, nothing rendered. Now in Admin → Appearance and the footer.
4. **Hard-coded wording and colours** (red buttons/prices, "Delivery 1–2 hours", headings…) – now driven by Admin → Website Text and the theme.
5. **Category cover controls were incomplete**; the description was drawn on top of the image. Now title + description sit right under a height-controlled image, with fallback, position, colours, own title.
6. **Payment display** (logo / label / order / visibility) did not exist. The footer showed "Online" even when no gateway was connected.
7. **Invoice** was a hard-coded popup. Now a real, customisable invoice for every order (customer + admin).
8. **No `seo.ts`** although the layout referred to it → no canonical/OG per page. Added. Product pages now have real JSON-LD (no invented rating/price/availability).
9. **`/policy` page was outside the store layout** (no header/footer/theme). Moved into `(store)`.
10. Favicon was one 512 px image (blurry at 16 px). Generated 16/32/48/180/192/512 + `favicon.ico` + web manifest.

## New in the admin (left menu)
Operations · Staff · Attendance · Courier Services · Appearance · Website Text · Invoice (+ Delivery Areas "delivered by courier", order → courier + tracking, payment display).

## Things to know
- Netlify has no persistent disk: set the Firebase variables (see DEPLOYMENT.md) or settings, orders and uploads will not survive a deploy.
- Staff, attendance and couriers are admin-only collections (the public API returns an empty list).
- Customers open their invoice with order number + the phone used at checkout (`/invoice?no=…&phone=…`), same rule as order tracking.

---

# Round 3 – mobile products page

- **Filters moved out of the way on phones.** Categories / Max price / Sort by now open from a "Filters" button in a drawer that slides in from the LEFT, so the first screen shows products. On desktop they stay in the left column. (`components/store/FilterLayout.tsx`; button/apply wording is editable in Admin → Website Text.)
- **Unlimited categories.** The footer listed only 5; it now lists every category. The filter drawer, header chips and home page already showed all.
- **Per-category cover image is easier to find.** Admin → Categories: every category card has its own cover strip ("＋ Add cover image for this category" / "Change cover"). The cover is shown on that category's page, with its title and description right under it.

## Latest review (Oct 2026)
- Admin employee API no longer returns `passHash` (list, edit, approve/reject).
- `/api/health` now requires admin sign-in (was public).
- Orders are placed one at a time per server instance (prevents two customers taking the last item).
- Added branded 404 (`not-found.tsx`) and error (`error.tsx`) pages.
- Small global UI polish in `globals.css` (focus rings, smooth scroll under sticky header, press feedback, reduced-motion support).
