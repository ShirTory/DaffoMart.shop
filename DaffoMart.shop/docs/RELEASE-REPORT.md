# DaffoMart — Release Report (2026-10-18)

Replaces the earlier `PROJECT-AUDIT-REPORT.md` (kept in `docs/archive/`; it described features as "working" that were never run).

## Verification environment — what was and was not possible
- Sandbox had **no npm registry access**: no `npm ci`, **no `next build`, no real `tsc`**.
- `tsc` was run against the whole project with stub typings for third-party packages: no real type errors found in project code (only stub artifacts). **Not a substitute for `npm run build`.**
- `npm test`: **28/28 pass** (local JSON driver, stubbed Next/zod/jose).
- No browser, no Firebase credentials: UI, Firestore and deployment items are **not verified**.
- The `build-log.txt` shipped in the ZIP was from an older version (no Finance/Audit/IT-Support routes), so the current code had never been compiled before this review.

## Status by area
| Area | Status |
|---|---|
| Admin authorization (IT Support limited access, live revocation) | COMPLETE AND VERIFIED (unit-level) |
| Order atomicity + idempotency — local driver | COMPLETE AND VERIFIED |
| Order atomicity — Firestore transaction | IMPLEMENTED, NOT VERIFIED (needs Firebase) |
| Finance: Dhaka dates, `deliveredAt`, cash-basis cash-flow, duplicate guard, validation | COMPLETE AND VERIFIED (unit-level) |
| Finance UI (cashflow note) | IMPLEMENTED, NOT VERIFIED (no browser) |
| `next build` / lint / type-check | BLOCKED (no registry) — run `npm ci && npm run lint && npm run build` |
| Homepage/header/hero/categories/cards responsive layout | NOT STARTED (no changes, not inspected visually) |
| Floating WhatsApp/Call vs bottom nav | NOT VERIFIED (CSS not rendered) |
| Admin settings → storefront sync (cache tag revalidation) | NOT VERIFIED (code path read only) |
| Products, inventory, riders/employees permissions, uploads | NOT REVIEWED in depth |
| Firestore/Storage rules deployed | BLOCKED (needs Firebase access) |
| Customer accounts / NID flow, staff module ACL | PARTIALLY COMPLETE (pre-existing gaps, unchanged) |
| Screenshots before/after | NOT STARTED (no browser) |

## Bug-fix report
| ID | Root cause | Files | Fix |
|---|---|---|---|
| S1 | `requireAdmin()` accepted any admin session, including IT Support without `fullAccess`; only finance/audit used a stricter guard | `server/auth.ts`, `admin/(panel)/layout.tsx`, `admin/invoice/[id]/page.tsx`, `components/admin/LimitedAccess.tsx`, `api/admin/system`, `api/health` | `requireAdmin` now requires full access; new `requireSession` for diagnostics; limited accounts see an "access not granted" screen |
| S2 | JWT carried `fullAccess`/role for 12 h and was never re-checked | `server/auth.ts` | `getAdmin()` re-reads the account from DB each call; fails closed |
| D1 | Stock decremented line by line, then order written; process-local lock ineffective across serverless instances | `server/db.ts`, `server/services.ts` | `db.placeOrder`: Firestore transaction / atomic local write; shared pure `planStock` |
| D2 | No idempotency | `lib/validators.ts`, `server/services.ts`, `CheckoutForm.tsx` | Client key per cart → order id = hash(key); retry returns the same order |
| F1 | Finance used UTC dates | `server/finance.ts` | Dhaka (UTC+6) day boundaries |
| F2 | Revenue dated by `updatedAt` | `finance.ts`, `services.ts`, `lib/types.ts` | `Order.deliveredAt` set on first delivery; legacy fallback to `updatedAt` |
| F3 | Manual income could link to a delivered order | `finance.ts` | 409 on delivered / 404 on unknown order |
| F4 | Cash-flow counted unpaid delivered orders | `finance.ts`, finance page | Cash-basis cash-flow; P&L stays accrual |
| F5 | Unvalidated dates, float drift | `finance.ts`, 4 finance routes | `parseRange`, `isRealDate`, rounding. (A first-draft crash on `2026-13-01` was caught by a test and fixed.) |
| — | `/employee` area indexable; order numbers used `Math.random` | `next.config.mjs`, `services.ts` | noindex header; `crypto.randomInt` |
| — | `build-log.txt`, `install-log.txt`, `tsc-log.txt`, `h origin main`, duplicate Google file in repo root | repo | removed; `.gitignore` updated; old notes moved to `docs/archive/` |

## Data and migration
All changes are additive and backward-compatible: new optional `Order.deliveredAt`; new optional `idempotencyKey` request field (not stored). No collection renamed, nothing deleted, no migration script required. Existing delivered orders keep working through the `updatedAt` fallback. Optional: backfill `deliveredAt = updatedAt` for old delivered orders to freeze their revenue dates — not done, would need authorization.

## Known limitations / decisions for the owner
1. Advance payments: a manual income linked to an in-progress order that is later delivered is counted twice. Only already-delivered links are blocked.
2. `pendingReceivables` ignores bKash/Nagad orders in `pending` (unverified) state. Business decision; unchanged.
3. `AUTH_SECRET` minimum length is not enforced in code (use 32+ chars). `PAYMENT_TEST_MODE` must be unset in production.
4. Order status transitions are unrestricted (e.g. delivered → cancelled restores stock). Unchanged.
5. Rate limiting is in-memory per instance.
6. `npm test` needs Node 22.7+; production build stays on Node 20 (`netlify.toml`).

## Remaining production prerequisites
`npm ci && npm run lint && npm test && npm run build`; staging smoke tests in `docs/TESTING.md`; deploy Firestore/Storage rules; Firestore backup; real-device layout check.


---
# Update (accounting + SKU/permissions pass)

See `docs/ACCOUNTING.md` for formulas and limitations.

## Checklist (tests = `npm test`, local JSON driver with stubbed Next/zod/jose; 50/50 pass)
| Requirement | Status |
|---|---|
| Income, expenses, filters, export (existing) | PASS (existing tests; UI NOT TESTED) |
| Salary payroll: entries, partial/full payments, balance, history, statements | PASS (unit) · UI NOT TESTED |
| Rider earnings: eligibility, no duplicates, dated terms, adjustments, payments, self-view | PASS (unit) · UI NOT TESTED · rider self API NOT TESTED |
| Suppliers, purchases, stock-once, avg cost, dues, valuation | PASS (unit) · UI NOT TESTED |
| Cashbook / opening balances / reconciliation / receivables | PASS (unit) · UI NOT TESTED |
| P&L with payroll, rider cost, COGS (honest when cost missing) | PASS (unit) |
| Accountant role + server-side limits | PASS (unit) |
| Atomic SKU uniqueness (concurrent saves) | PASS (local driver) · Firestore `create()` path NOT TESTED |
| NID photos: Owner only + audit | IMPLEMENTED, NOT TESTED |
| Homepage section order/visibility, labels, support buttons in Admin | EXISTING, NOT VERIFIED visually |
| Mobile layout (360/390/430), hero height, sticky/z-index | NOT TESTED (no browser) |
| Staff role with assigned modules (Phase 9.3) | MISSING |
| Draft/preview/publish for homepage | MISSING |
| Order status transition rules | UNCHANGED (documented gap) |
| `npm ci`, `tsc`, lint, `next build` | BLOCKED (no registry). Type-check ran only against stub typings with noImplicitAny off |
| Real Firestore / Storage rules / browser / real devices | BLOCKED |
