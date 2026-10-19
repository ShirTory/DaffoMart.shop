# DaffoMart Project Audit & Delivery Report
**Date:** 2026-10-18  
**Source:** Working tree `DaffoMart.shop-main` (upgraded from original ZIP)  
**Environment limits:** No live Firebase credentials; npm install timed out in CI sandbox; no browser automation for screenshots.

---

## 1. Architecture (verified by code inspection)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 App Router + React 19 + TypeScript |
| Styling | Tailwind CSS 3 |
| State (cart) | Zustand client |
| Validation | Zod |
| Auth | JWT HttpOnly cookies (`jose`) — admin / employee / rider |
| Data | Firebase Admin SDK **or** local JSON (`.data`) when Firebase unset |
| Deploy | Netlify + `@netlify/plugin-nextjs`, Node 20 |
| Images | Sharp → WebP via `/api/upload` |

**Entry points:** `src/app/(store)/*` storefront · `src/app/admin/*` admin · `src/app/rider/*` · `src/app/employee/*` · `src/app/api/*`

**Core collections (Col type):** products, categories, banners, offers, orders, settings, zones, riders, stocklogs, images, nid, employees, attendance, couriers, payment_methods, ratings, issues, audit_logs, admins, customers, finance_expenses, finance_incomes

---

## 2. Feature status matrix

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Store homepage + products | **Working (code)** | `page.tsx`, queries, ProductCard |
| Homepage section order (Admin) | **Working (code)** | `homeSections` + Content admin UI |
| Thin mobile hero | **Working (code)** | HeroSlider `max-h-[140px]` / aspect 21/9 |
| Categories compact scroll | **Working (code)** | Homepage + Admin categories |
| Product cards ৳ / stock / discount | **Working (code)** | ProductCard; labels from labelRules |
| Product labels (Best/New/Offer/OOS) | **Working (code)** | Admin Content + ProductCard |
| Cart (Zustand) | **Working (code)** | `lib/store.ts` |
| Checkout + server totals | **Working (code)** | `services.ts` recompute stock/price/delivery |
| Order track / cancel | **Working (code)** | Existing track + cancel API |
| SKU unique + required if active | **Working (code)** | validators + resources + Admin UI + backfill API |
| Admin settings → storefront | **Working (code)** | settings PUT merge; getSettings cached 60s |
| Banners / offers / appearance | **Working (code)** | Existing admin modules |
| Delivery zones | **Working (code)** | zones API + checkout |
| Rider app + live map | **Working (code)** | rider routes + LiveMap |
| Employee/staff applications | **Working (code)** | employee register/review |
| Owner + IT Support accounts | **Working (code)** | admins collection + IT Support page |
| Audit logs | **Working (code)** | audit_logs + Admin Audit page |
| Finance overview/income/expense/P&L/cashflow/reports | **Working (code)** | finance.ts + /admin/finance |
| Finance auto income from delivered orders | **Working (code)** | Derived, not duplicated |
| Floating WA/Call vs bottom nav | **Improved (code)** | safe-area + bottom calc above BottomNav |
| firestore.rules / storage.rules in repo | **Present** | Must deploy via Firebase Console |
| Customer accounts + customer NID flow | **Missing / partial** | Flag only; orders are phone-based |
| Staff fine-grained module ACL | **Partial** | Employees exist; not full module matrix |
| Live Firebase integration | **Not verified** | No credentials in this environment |
| npm build / tsc | **BLOCKED** | `npm install` timed out in sandbox |
| Visual screenshots 360/390/430 | **NOT TESTED** | No browser automation here |
| Production deploy | **NOT DONE** | Explicit authorization required |

---

## 3. Change log (upgrade series)

Significant additive changes (backward-compatible):

1. **SKU** — `Product.sku`, uniqueness, publish guard, Admin form, backfill API  
2. **Homepage** — `homeSections`, Daily/Fresh/Household titles & category IDs  
3. **Labels** — `labelRules` on settings → ProductCard  
4. **Auth** — Owner vs IT Support (`admins`, `requireOwner` / `requireFullAdmin`)  
5. **Audit** — `audit_logs`  
6. **Finance** — `finance_expenses`, `finance_incomes` + Admin Finance module  
7. **Rules files** — `firestore.rules`, `storage.rules`  
8. **SupportButtons** — safe-area + bottom-nav clearance  

No collection renames; no deletion of historical order/product IDs.

---

## 4. Admin persistence (code-path verification)

| Setting | Save path | Storefront read | Verified live? |
|---------|-----------|-----------------|----------------|
| Announcement, phone, WhatsApp | `PUT /api/settings` → `settings/store` | Header, SupportButtons | **NOT TESTED** live |
| homeSections / labels | same | Homepage, ProductCard | **NOT TESTED** live |
| Banners | banners CRUD | HeroSlider | **NOT TESTED** live |
| Categories hide/order | categories CRUD | Homepage chips | **NOT TESTED** live |
| Delivery zones | zones API | Checkout | **NOT TESTED** live |

Persistence is implemented via Firestore/local driver; **revalidateTag** on store cols. Confirm on staging after deploy.

---

## 5. Security report

| Item | Status |
|------|--------|
| Admin JWT HttpOnly | Code present |
| Server-side order price/stock | Code present |
| Finance/IT gated by requireFullAdmin | Code present |
| Client Firestore writes | Rules file denies (must **deploy** rules) |
| Storage public read | Rules deny all client access |
| Secrets in client | Only `NEXT_PUBLIC_*` — good pattern |
| Dev default admin password | **Risk** if `ADMIN_PASSWORD` unset in production — blocked when env missing in prod path |
| Rules not deployed | **Unresolved** until Firebase Console action |

---

## 6. Finance validation (logic only — NOT live-tested)

- Revenue = sum of `orders` with `status === "delivered"` (`.total`)  
- + manual `finance_incomes`  
- Expenses = `finance_expenses`  
- Net profit = income − expense (**not** labeled as gross sales)  
- Order-linked income is **read-only** (no duplicate delete)  
- **NOT TESTED** with real order fixtures in this environment  

---

## 7. Testing report

| Test | Result |
|------|--------|
| Code inspection of critical paths | **PASS** (inspection) |
| `npm install` | **BLOCKED** — sandbox timeout |
| `npm run lint` (tsc) | **BLOCKED** — no node_modules |
| `npm run build` | **BLOCKED** |
| Homepage load against Firebase | **BLOCKED** — no credentials |
| Checkout + stock | **NOT TESTED** |
| Admin settings save + reload | **NOT TESTED** |
| Finance reconciliation | **NOT TESTED** |
| Role escalation attempts | **NOT TESTED** |
| Screenshots 360/390/430/768/1366 | **NOT TESTED** |
| Floating button collision | **NOT TESTED** visually — CSS fixed by inspection |

---

## 8. Data preservation

- Additive fields only (`sku`, settings keys, new collections).  
- No migration that rewrites order IDs.  
- SKU backfill never overwrites existing SKUs.  
- Backup: keep original ZIP + this tree before production push.

---

## 9. Deployment guide (Netlify)

1. Set env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, Firebase vars.  
2. Build: `npm run build` (Node 20).  
3. Deploy `firestore.rules` + `storage.rules` via Firebase CLI/Console.  
4. Staging first; production only with authorization.  
5. Rollback: previous Netlify deploy + optional rules version restore.

---

## 10. Remaining limitations / next actions

1. Run `npm ci && npm run lint && npm run build` on a normal machine.  
2. Staging smoke: settings, SKU, finance, WA/Call on real phone widths.  
3. Deploy security rules.  
4. Backfill SKUs for active products.  
5. Customer NID end-to-end still not a full product (orders are phone-based).  

**Do not treat this package as production-verified until staging tests pass.**
