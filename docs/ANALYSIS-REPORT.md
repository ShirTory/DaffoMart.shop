# DaffoMart – Audit & Remediation Report (v2)

**Date:** 19 Oct 2026 · Source: `DaffoMart-Integrated-Final.zip` (Next.js 15, TypeScript, Firebase/Firestore, Netlify)
This report supersedes the earlier one. Every item below was checked in the code; items I could not execute are marked **BLOCKED / NOT VERIFIED**.

## 1. What was actually executed (real results)

| Command / check | Result |
|---|---|
| `npm test` (node test runner, local JSON driver, stubs for zod/jose/sharp/next) | **65 / 65 pass** (original 52 + 13 new regression tests) |
| `tsc --noEmit`, before vs after, filtered for missing-dependency noise | **0 new errors**; 1 real error fixed (`tests/auth.test.ts`). 26 filtered messages remain, all caused by missing `react`/`next` type packages in the sandbox |
| Secret scan (key patterns: AIza, PRIVATE KEY, sk_live, ghp_, xox, AKIA) over the source tree | none found; `.env.example` holds placeholders only |
| Dry-run `git add -A` with the new `.gitignore` | `.env*`, `.data/`, `node_modules/` not staged (only `.env.example`) |
| `npm ci` / `npm install` | **BLOCKED**: sandbox has no network (install aborted) |
| `npm run lint`, `next build` | **BLOCKED** (needs the installed dependencies) |
| `npm audit` / dependency vulnerability scan | **BLOCKED** (needs network) |
| Browser / mobile / responsive QA, end-to-end tests | **NOT VERIFIED** (no browser, no running app) |
| Firestore code paths (`find`, `mutate` transactions, indexed queries) | **NOT VERIFIED** (no Firebase credentials/emulator). Local driver equivalents are tested |
| Git history scan for old secrets | **NOT VERIFIABLE**: the zip contains no `.git` folder. Run `git log -p -S"PRIVATE KEY"` and a tool such as gitleaks on your real repo |
| Production deployment (Netlify), real payment gateway | **NOT VERIFIED** |

## 2. Confirmed findings and fixes

### Launch blockers
| # | Sev | Finding | Fix | Regression test |
|---|---|---|---|---|
| 1 | High | No `.gitignore`; push script would upload `.env.local`, `.data/` (customer/NID data), `node_modules` | `.gitignore` added; script refuses without it and unstages `.env*` | dry run (manual) |
| 2 | High | Type error in `tests/auth.test.ts` broke `lint`/`build` type-check | helper type corrected | tsc diff |
| 3 | High | Sandbox payment gateway could mark any order paid if `PAYMENT_TEST_MODE=true` leaked into production | Fail closed: ignored in production unless a second, deliberate switch is set; config checker flags both | `security.test` (gateway), `routes.test` (callback returns 503, order stays unpaid) |
| 4 | High | Payment callback did not check amount, currency, order state, payment method or TrxID reuse | Callback only settles `online` orders, never re-processes a paid order (idempotent), refuses paid when amount/currency mismatch, order cancelled/returned, or reference used by another live order (logged for review). Adapter contract documented | partly (see limits) |
| 5 | High | Production on Netlify without Firebase silently wrote to `/tmp` (all data lost on cold start) | `storageProblem()` makes the DB layer throw in production on serverless hosts; the System check lists it; build phase is exempt | `security.test` |

### Security / privacy
| # | Sev | Finding | Fix | Test |
|---|---|---|---|---|
| 6 | High | Purchase `cost` exposed in `/api/products`, product detail, storefront cache, `/api/orders/track`, public invoice | stripped for everyone except full-access admins | `routes.test`, `security.test` |
| 7 | High | `/api/ratings` returned customer phones publicly | phones removed, first name only; admins unchanged | `routes.test` |
| 8 | High | Employee registration overwrote an existing inactive/approved record (takeover) | any non-rejected record → 409 | code review (no route test) |
| 9 | High | Order issues could be filed as "rider" or "customer" with no proof | customer must give the order's phone; rider must be signed in AND assigned to that order | `routes.test` |
| 10 | Med | Ratings accepted any caller with an order id | order phone must match | `routes.test` |
| 11 | Med | IT-Support without full access / Accountant could read rider, employee, courier lists | `getFullAdmin()` used for privileged reads | existing role tests |
| 12 | Med | Sessions stayed valid after a password change | `pwChangedAt`; older tokens rejected for admin, rider, employee accounts (owner env password: rotate `AUTH_SECRET`) | `security.test` |
| 13 | Med | Rate-limit bypass via spoofed `X-Forwarded-For`; login throttled only per IP | platform IP header first; extra per-account throttle (still in-memory) | no test (needs headers/time) |
| 14 | Med | Duplicate bKash/Nagad TrxID across orders | rejected while the other order is live; stored upper-case | `security.test` |
| 15 | Med | Rider/employee image could be any URL (breaks `next/image`) | only own uploads accepted | no test (needs sharp) |
| 16 | Low | JSON-LD not escaped; `//host` accepted as image URL; no HSTS / Permissions-Policy / COOP / CSP basics | escaped; validator tightened; headers added (CSP without `script-src`, see limits) | no test |

### Data integrity / concurrency
| # | Sev | Finding | Fix | Test |
|---|---|---|---|---|
| 17 | Med | `db.update`, stock restore and stock adjust were read-modify-write: concurrent requests could lose writes; two simultaneous cancels could restore stock twice | all updates are atomic (Firestore transaction / synchronous local driver); stock-restored flag is claimed atomically; `adjustStock` atomic | `security.test` (25 parallel updates, triple cancel) |
| 18 | Med | `POST /api/products` skipped the atomic SKU reservation | id generated first | code review |
| 19 | Med | Full-collection scans on track, cancel, my-orders, login, register, ratings, issues, invoice, rider orders, TrxID check | indexed equality queries (`db.find`); authorization unchanged | local driver via tests; Firestore NOT VERIFIED |

### Functional / UX
| # | Sev | Finding | Fix |
|---|---|---|---|
| 20 | Med | Hydration mismatch on `ProductCard` for returning customers | `useMounted()` gate |
| 21 | Med | 10 orders/IP/10 min blocked students sharing campus Wi-Fi; `+8801…` numbers rejected | 40/IP + 5/phone; phone normalised in checkout, API, rider/employee login |
| 22 | Low | Issue **video** upload never worked (silently dropped) | UI limited to photos (max 5); server returns a clear 400 for video |
| 23 | Low | Demo products and fake sales counts seeded in production | seeded only outside production unless `SEED_DEMO=true` |
| 24 | Low | Quantity clicks hammered coupon validation (429 risk) | 500 ms debounce |
| 25 | Low | Sold-out items vanished from the cart silently | `CartNotice` explains removals/reductions on cart and checkout |
| 26 | Low | Bad JSON on ratings/issues returned 500 | 400 via `readJson` |

## 3. Files changed
`.gitignore`, `.env.example`, `push-to-github.ps1`, `next.config.mjs`, `PAYMENTS.md`, `README.md`, `docs/ANALYSIS-REPORT.md` ·
`src/server/`: `db`, `auth`, `crud`, `resources`, `queries`, `services`, `http`, `storage`, `riderAuth`, `adminAccounts`, `seed`, `envCheck` (new), `gateways/test`, `payments` ·
`src/app/api/`: `products`, `ratings`, `issues`, `issues/[id]`, `orders`, `orders/track`, `orders/cancel`, `orders/my`, `payments/online/init`, `payments/online/callback`, `rider/{me,login,register}`, `employee/{me,login,register}`, `auth/login`, `admin/system` ·
`src/app/`: `layout.tsx`, `invoice/page.tsx`, `(store)/cart/page.tsx`, `(store)/pay/test/page.tsx`, rider panel page ·
`src/lib/`: `validators`, `hooks`, `types` · `src/components/store/`: `ProductCard`, `CheckoutForm`, `TrackForm`, `CartNotice` (new) ·
`tests/`: `auth.test.ts`, `security.test.ts` (new), `routes.test.ts` (new), `hooks.mjs`, `stubs/jose.mjs` (now sets `iat` like the real library), `stubs/sharp.mjs` (new)

## 4. Accepted limitations / not changed (and why)
- **No real payment gateway exists in the code.** Online payment must stay disabled in production. COD and manual bKash/Nagad are unaffected. The callback hardening is defence-in-depth for a future adapter, not proof of a verified gateway.
- **Rate limiting is in-memory per serverless instance.** Per-account throttles help but do not stop a distributed brute force. Use a shared store (Upstash/Redis) and a long random `ADMIN_PASSWORD`.
- **CSP has no `script-src`**: a strict one needs per-request nonces and would break Next inline scripts without browser testing.
- **Customer access is phone number only** (orders, track, cancel, invoice). An SMS OTP is a business/product decision; not added.
- **Coupon usage limits / per-customer limits not implemented**: no such business rule exists in the code and none was specified.
- **Order-status transitions are not restricted for admins** (re-opening a cancelled order is an existing, tested feature). Public cancel (pending, 2-minute window), rider and payment transitions are restricted.
- Stock restore updates the order flag and each product in separate atomic steps (no cross-document transaction); a crash between them could leave stock unrestored. Rare, recoverable with Stock adjust.
- `createOrder` still reads the product list to price the cart (the stock decrement itself is a transaction).
- Legacy orders saved with a lower-case TrxID are not matched by the duplicate check; new orders are stored upper-case.
- Env-var owner password: changing it does not revoke open owner sessions. Rotate `AUTH_SECRET` to sign everyone out.
- New Firestore queries use single-field equality (auto-indexed); no composite index needed.

## 5. Required configuration
Netlify environment: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ chars), `AUTH_SECRET` (32+ random chars), `NEXT_PUBLIC_SITE_URL` (https), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET` (or images-in-DB mode). **Do not set** `PAYMENT_TEST_MODE`, `ALLOW_PAYMENT_TEST_IN_PRODUCTION`, `SEED_DEMO`, `ALLOW_EPHEMERAL_STORAGE`. No secret may live in a `NEXT_PUBLIC_*` variable (the checker flags it).
Deploy `firestore.rules` and `storage.rules`. Admin → System check now lists every configuration problem (no secret values shown).

## 6. Launch checklist (in order)
1. On your PC: `npm ci && npm run lint && npm test && npm run build` – all must pass (not verified by me).
2. `npm audit` and a Git-history secret scan on your real repository; rotate anything that was ever committed.
3. Set the Netlify variables above; open Admin → System check → "Test connection"; the problem list must be empty.
4. Deploy Firestore/Storage rules.
5. Delete any demo products left from earlier runs; confirm online payment is OFF in Settings.
6. `.\push-to-github.ps1 -Repo "https://github.com/<you>/<repo>.git"` and check `git status` shows no `.env*` or `.data/`.
7. After deploy test on a phone: browse → cart → coupon → COD order → track → cancel; bKash order with TrxID (reuse must be refused); rider login/status/location; employee register/login; accountant and IT-support restrictions; sign in again after changing an admin password.
8. Monitor Netlify function logs for `[payment] refused to mark paid` and 5xx storage errors in the first days.
