# Testing

## Automated (`npm test`, Node 22.7+)
Uses Node's built-in test runner with a tiny resolver (`tests/hooks.mjs`) for the `@/` alias. Next.js, zod and jose are replaced by stubs in `tests/stubs/`, so the suite exercises **business logic against the local JSON driver**; it does not start Next.js, does not use Firestore, and does not test JWT cryptography.

| File | Covers |
|---|---|
| `tests/orders.test.ts` | stock decrement, idempotent checkout, 10-way concurrency on 3 units, all-or-nothing rollback, cancel/return stock restore, `deliveredAt` |
| `tests/finance.test.ts` | Dhaka day boundaries, revenue dating, P&L, cash-basis cash-flow, duplicate-income guard, date validation, rounding |
| `tests/auth.test.ts` | IT Support without full access gets 403, forged-token claims ignored, revoke/deactivate/delete take effect immediately |

## Manual staging smoke tests (not yet performed — require Firebase + a browser)
1. **Firestore transaction:** with real Firebase, place 2 simultaneous orders for the last unit from two browsers; exactly one must succeed.
2. **Idempotency:** place an order, then re-send the same request body (same `idempotencyKey`); the same order number comes back and stock drops once.
3. **Settings sync:** change announcement, phone, banner, category order and a delivery charge in Admin; the storefront must reflect each within seconds after refresh.
4. **Roles:** create an IT Support account without full access; confirm `/api/orders`, `/api/products` (POST) and `/admin/orders` are refused, then grant access and confirm they work; revoke and confirm again without re-login.
5. **Finance:** deliver a COD order and a bKash order (payment still *pending*); the P&L counts both, Cashflow only the COD one. Mark bKash *paid*; Cashflow now counts it.
6. **Layout:** at 360, 390, 430, 768 and 1366 px check header, hero, category strip, product cards, bottom nav and the floating WhatsApp/Call buttons for overlap.
7. `GET /admin/system?test=1` (Admin → Settings → Firebase test) reports Firestore OK.
