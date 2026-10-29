# DaffoMart upgrade — October 2026

Stack, Firebase/Firestore, auth, admin panel and existing database collections are unchanged. All additions are optional fields / new collections / new files.

## Completed and tested
Automated: `npm test` → 95 tests (65 existing + 30 new) pass. Browser (Chromium): ticker direction, pause, reduced-motion fallback, hero heights, no horizontal overflow at 375 / 768 / 1366 px (on the real CSS, in a test page — not on the running Next.js app, see "Not tested").

| # | Feature | What was done |
|---|---|---|
| 1 | WhatsApp | Admin → **WhatsApp & Calling** (Owner can edit). Official Meta Cloud API client; template or text mode; order confirmation to customer, new-order alert to you, optional status updates. Sent *after* the checkout response; an order never fails because of a message. Log per message: `skipped` / `accepted` / `failed`; `delivered` / `read` only via Meta's signed webhook (`/api/whatsapp/webhook`). Never reports success without an API message id. One message per order+recipient (retry-safe), manual Retry. Real "send test" button. |
| 1 | Calling | Modular placeholder (`src/server/integrations/calling.ts`): provider registry, status, admin settings. `/api/admin/calling/start` answers **501** until a provider is implemented. Tap-to-call (`tel:`) links already work. |
| 2 | Themes | Admin → **Website Theme**: 4 presets (Fresh Market = your current look, Clean Minimal, Bold Deals, Elegant Boutique) switchable any time + overrides for fonts, text size, corners, card style, headings, page background, product row layout, hero sizes, category style, section headings. Section order/visibility stays in Website Content; banners in Cover Images. |
| 3 | Category ticker | Auto-moving, seamless, left→right; pauses on hover/focus and with a Pause/Play button; static wrapped list when the device asks for reduced motion; round / square / pill styles; speed in theme. |
| 4 | Offers carousel | New home section "Offers carousel": only published products with Old price > Price and inside their optional **Offer starts/ends** dates (new fields on the product form). Real ProductCard (price, discount, stock, Add to cart, Buy now) + "Ends in N days". Fewer than 4 offers → shown statically. |
| 5 | Hero / grids | Mobile cover unchanged (21:9, max 140 px). Desktop hero 220 px by default (admin range 120–400, recommended 180–240). Product grids unchanged; page wrapper clips horizontal overflow. |
| 6 | Excel | Admin → **Excel Import/Export**. Dependency-free .xlsx reader/writer. Export: products, inventory, orders (date/status filter), customers, reports. Import: products (by SKU), inventory (by SKU, writes stock log), customers (by phone). Two-step (preview → confirm), row-level errors, duplicate-in-file and duplicate-in-database protection, formula-injection protection, 5 MB / 2,000-row limits. Orders/reports are export-only on purpose. |
| 7 | CRM | Admin → **Customers (CRM)**. Auto-saved from every order (id = normalized phone → duplicates impossible), manual add/edit/search/filter (segment, status, area), notes, follow-ups, WhatsApp/call shortcuts, order history, totals recomputed from real orders (never double-counted), segments new/regular/VIP/inactive (rules in `CRM_RULES`, per-customer override), "blocked" status stops online checkout, "Sync from orders" backfill, Excel export. |
| 8 | Conversion | Product page reduced to name, price, pack size, stock, quantity, Add to cart, Buy now (description in a collapsible). Checkout: no account, GPS and note collapsed, details remembered on the device, sticky mobile "Place order" bar. Install-app popup no longer shows on cart / checkout / track. |

## Security
* Roles: CRM, imports, order/customer/inventory/product exports → full Admin access (`requireAdmin`; Accountant and diagnostics-only IT are refused). **Reports export → Finance access.** Integrations & test send → Owner only. Customer deletion → Owner only. All imports/exports/changes written to the audit log.
* Firestore rules: `integrations`, `message_logs`, `customers` are server-only (deny all client access). Rules file updated — **re-deploy `firestore.rules`.**
* WhatsApp secrets exist only as environment variables; never stored, logged, or sent to the browser. Webhook rejects unsigned/incorrect signatures.

## Pending — needs your credentials / action
1. Netlify/Vercel env: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.
2. Meta Business: create + get approval for the message templates (order confirmation, new order alert, status update), enter template names and variable order in Admin → WhatsApp & Calling, add the webhook URL shown there, subscribe to "messages".
3. Admin → Customers → **Sync from orders** once, to create customers from past orders.
4. Re-deploy `firestore.rules`.
5. A real calling provider (placeholder only).

## Not tested (could not be done in this environment)
* **`next build` and `tsc` on the whole project**: packages cannot be installed here. All changed files pass a syntax parse and the pure server modules pass type-checking, but the React/Next pages were not compiled — run `npm install && npm run lint && npm run build` before deploying.
* The new pages and the real storefront were not opened in a browser against Firestore; WhatsApp was tested against a mocked API only (no live Meta call); Firestore transactions for the new code paths were exercised on the local JSON driver only.
* Opening the exported .xlsx in desktop Excel (verified with openpyxl/LibreOffice-compatible readers only).
* Page-level Tailwind layout (cards, checkout bar) at 360/390/430/768/1366 px: please follow the checklist in `docs/TESTING.md`.

## Known limits / decisions
* Product options (size / weight / colour) are supported: see `docs/VARIANTS-AND-CATEGORY-ORDER.md`. Products without options behave exactly as before.
* Theme presets differ by palette, fonts, corners, cards, headings, category style and layout — not separate page templates. Fonts are system fonts (no external font download).
* An expired offer window only removes the product from the Offers carousel; the product's price is whatever you saved (change Price/Old price too).
* The unit of "Offer ends" is a Bangladesh calendar day, inclusive.
