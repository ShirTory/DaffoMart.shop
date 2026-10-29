# Product variants (size / weight / colour) and category order

## What was added
**Variants** – a product can have options, each with its own price, old price, stock and optional SKU / colour swatch.
- Admin → Products → "Options": add rows by hand or type `S, M, L` / `500 g, 1 kg` / `Red, Blue` and press *Create options*.
- Product price, old price and stock are derived from the options (price = cheapest, "From ৳X"; stock = total), so cards, filters, sorting and SEO need no special case.
- Storefront: product page shows chips per attribute; price and stock follow the chosen option. Cards of such products show "Choose options". Cart lines are product + option.
- Server: the price always comes from the stored option; stock is checked and decremented per option inside the same atomic step as the order; cancel/return restores the same option.
- Inventory and Purchases ask which option. Excel product import keeps options (its Price column is ignored for them). Excel inventory import reports an error for option products (use Admin → Inventory).

**Category order** – Admin → Categories: ↑ ↓ buttons save the order at once (`POST /api/categories/reorder`), "On home page" / "Visible" toggles on each card, and a preview of the home strip in the exact order shown to customers.

## Migration / rollback
- No migration: existing products have no `variants` and behave exactly as before. Old carts and orders keep working.
- Rollback: redeploy the previous build. Products saved with options keep a `variants` array that the old code ignores (price/stock fields stay valid).

## Tests
`npm test` → 114 tests (16 variant, 3 category order, 95 existing). Run in a sandbox with stubbed zod/next; real zod was checked separately for the new schemas.

## Not verified / limits
- `next build` and browser UI were not run in the sandbox (no network for npm install). Please run `npm ci && npm run lint && npm test && npm run build` and click through: add options, choose on product page, checkout, cancel.
- Variant SKU is not checked for uniqueness. Cost price is per product, not per option.
- An admin saving a product at the same instant as an order can overwrite that order's stock change (same as before for plain products).
- Category reorder writes one category at a time (not one transaction).
