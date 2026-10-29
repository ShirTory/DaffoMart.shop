# Requirement checklist (2026-10-18) — evidence: `npm test` 47/47 on the local JSON driver (stubbed Next/zod/jose). No build, browser or Firebase was available.

| Requirement | Status | Evidence / note |
|---|---|---|
| Server-side prices, totals, stock decrement, idempotent checkout, concurrency | PASS | orders.test.ts |
| Customer cancel only within 2 min, only while pending, server clock | FIXED (logic moved to a testable service) | accounts.test.ts: 119 s ok, 121 s refused, non-pending refused, wrong phone refused |
| Valid order status transitions | FIXED | delivered→returned only, returned final, cancelled→pending only (tested) |
| Stock restoration exactly once, refund flag | PASS / FIXED | tested |
| Delivered/returned orders cannot be deleted | FIXED | route guard; not covered by an automated test |
| Order tracking (order no. + phone) | PASS (code) | rate-limited; not exercised by tests |
| "My Orders" by phone only | PARTIAL | anyone knowing a phone number can list its orders. Needs OTP |
| OTP verification | BLOCKED | no SMS/OTP provider configured or present; nothing mocked |
| Admin authentication & roles (Owner, Accountant, IT Support) | PASS | auth.test.ts + payroll.test.ts |
| Limited sessions must not read rider/staff personal data (NID, salary) | FIXED | privacy test fails without the fix, passes with it |
| NID photos admin-only, never public, views audited | FIXED | audit added; route not HTTP-tested |
| Firestore rules deny all client access incl. new collections | PARTIAL | rules updated, **not deployed or tested** |
| Staff (employee) panel limited to own data | NOT TESTED | uses requireEmployee; not exercised |
| Rider sees only own earnings | PARTIAL | session-derived id in code; not HTTP-tested |
| Income, expenses, void/reversal, audit trail, no double counting | PASS | finance/payroll/accounts tests |
| Gross sales / refunds / net profit separate | FIXED | tested incl. cross-month return |
| Cashbook with opening balances, reconciles with cash-flow | PASS | tested |
| Suppliers, purchases, payables, inventory value, no duplicate stock | PASS | tested |
| Staff payroll (periods, partial pay, snapshot, duplicates) | PASS | tested |
| Rider earnings (eligibility, duplicates, partial pay, adjustments, reports) | PASS | tested |
| Customer delivery charge vs rider cost shown separately | PASS | reported as margin, not revenue |
| Product SKU uniqueness | PARTIAL | enforced in `resources.ts` (409); not tested here; not transactional |
| Multiple product images, admin poster/offer uploads, editable settings sync | NOT TESTED | code present; needs browser + storage |
| Product badges Hot Sale / New / Discount / Mega / Top | PARTIAL | free-text badge plus automatic best-seller/new/offer labels; the five named presets do not exist |
| Mobile UI/UX, responsive layouts, WhatsApp/Call buttons | NOT TESTED | no browser; new pages use existing responsive classes |
| Rate limiting | PARTIAL | still in-memory per instance (weak on serverless); persistent limiter not built |
| `AUTH_SECRET` strength | FIXED (code) | production refuses < 32 chars; not unit-tested |
| `npm ci`, lint, `next build` | BLOCKED | no registry access; `tsc` only partly meaningful without packages |

## Storefront UI pass (2026-10-18)
| Item | Status | Note |
|---|---|---|
| Card quantity − / + (min 1, max remaining stock = stock − already in cart) | PARTIAL | rules unit-tested (cartRules.test.ts); the card UI itself was never rendered or clicked |
| Add to Cart / Buy Now use the selected quantity; out-of-stock and "Max in cart" disabled | PARTIAL | code only |
| No duplicate cart lines, quantity capped to stock | PASS (existing store logic, unchanged) | read in `lib/store.ts`; not executed |
| Compact homepage: shorter hero on desktop (≤220–240 px), tighter spacing/features strip, 2-column mobile product grid (6 cards), 3/4/5 columns on larger screens, rest behind "View all" | PARTIAL | code only, **not seen in a browser**; check banners are not cropped badly |
| Admin-ordered/hidden home sections, banners, offers, categories | PASS (code) | section logic untouched |
| Product variants | N/A | the project has no variants |

## Homepage restyle after reference screenshot (2026-10-18) — NOT TESTED in a browser
Dark-green header with search + bell + cart in one row; big rounded category tiles under the hero (Offers tile with real count badge, admin categories, All tile); mint feature strip; dark "hot deal" card built from the real top-discount product; peach "Hot deals" section; product cards with % discount pill. Not copied (no data or feature exists): group-buy deals, spin wheel, live countdowns, language toggle, delivery-area picker, voice search.
