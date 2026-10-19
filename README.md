# DaffoMart (Integrated Final)

Student-focused online grocery & medicine platform — Next.js 15 + TypeScript + Tailwind.

**This package is the merged production-ready codebase** combining the best of two source trees:
- `DaffoMart-updated.zip` — consolidated accounting, finance dashboards, auth, order lifecycle
- `DaffoMart-accounting.zip` — improved ProductCard (qty selector + stock rules), Header, pure cart helpers

See `docs/FEATURE-INTEGRATION-REPORT.md` for the full merge map. Accounting details: `docs/ACCOUNTING.md`.

## Quick start
```bash
cp .env.example .env.local   # set ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_SECRET
npm install
npm run dev                  # http://localhost:3000
```
Admin login: `/admin/login` (credentials from `.env.local`).  
Without Firebase, data lives in `.data/`.

## Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm test` | Unit tests (65 cases: auth, orders, finance, accounting, cart, security) |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |

## Major features
**Storefront:** responsive product grid, categories (grocery + medicine), search/filters, quantity-aware cart, checkout, order tracking, wishlist, PWA install prompt.  
**Admin:** dashboard, orders (status + rider assignment + invoice), products (multi-image, Rx fields), inventory, delivery zones, riders/employees, offers/coupons, content CMS, settings.  
**Finance:** cash-basis cash-flow, account balances, staff payroll, rider earnings, purchases & suppliers, P&L with COGS when costs exist, idempotent payments, no double-counting of salary/expenses.  
**Portals:** Rider app (earnings, live GPS) · Employee panel · Role-based access (Owner / Accountant / IT Support).

## Configuration
Copy `.env.example` → `.env.local`. Required for production:
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET`
- Optional Firebase: `FIREBASE_*` (see example)
- Optional Maps: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Never commit real secrets. Firestore/Storage rules are in `firestore.rules` / `storage.rules`.

## Tests performed in the integration environment
- All unit tests: **65 / 65 passed**
- `next build` and full browser QA: **not executed here** (run locally before deploy)

## Documentation
- `docs/FEATURE-INTEGRATION-REPORT.md` — what came from which source
- `docs/ACCOUNTING.md` — money rules, stock, payroll, purchases
- `docs/RELEASE-REPORT.md` — verification status & known limitations
- `docs/TESTING.md` — how to run tests
- `docs/REQUIREMENTS-CHECKLIST.md` — feature checklist
- `PAYMENTS.md`, `DEPLOYMENT.md`

## License / ownership
Private project. Integrate and deploy according to your own hosting (Netlify config included).
