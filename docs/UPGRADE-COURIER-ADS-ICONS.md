# Upgrade: icons, homepage, courier accounts, profit & ad analytics

## New / changed (all additive; no existing collection, API or setting was removed)
| Area | What | Where |
|---|---|---|
| Icons | One icon set (`BrandIcon`) for Facebook/Instagram/YouTube/TikTok/WhatsApp/Call/Email/Address and payment methods. Admin can upload a replacement image for each. Footer, Contact page and floating Call/WhatsApp buttons use it; Call = `tel:`, WhatsApp = `wa.me`. | Admin → Settings → "Social links & icons" |
| Header text | Already existed (scrolling announcement, Admin → Appearance). Unchanged. | |
| Homepage | Offers / Super Deals (sale) now directly under the hero. Stores that never reordered get the new default; a customised order is kept. Offers strip scrolls right→left, only when wider than the screen, and each offer is shown once per pass. Categories: each rendered exactly once in a gliding row (pause button, pauses on touch/hover). | Admin → Website content to reorder |
| Buttons / cart | My orders, Track order, Notification bell are raised "3D" buttons. Cart button bumps when an item is added and pulses softly while the cart has items. All motion is disabled with `prefers-reduced-motion`. | `globals.css` |
| Variants | Already complete (size/colour/weight, own price/stock/SKU, server-side re-pricing). Not modified. | |
| Courier Accounts | Per-parcel ledger (one record per order id). COD, received, delivery & return charge, who pays, return status, verify, correction with required reason, full audit history. Verified parcels post ONE expense `courier:<orderId>` ("Delivery Cost") to Accounts; re-saves update it, un-verify removes it. | Admin → Finance → Courier Accounts |
| Profit & Ads | Revenue, COGS, discounts, verified courier cost, other expenses, ad cost → net profit & margin, product-wise profit, best/worst, cost per order, orders per USD. Ad costs by date/campaign/product, manual or CSV import (re-import updates, never doubles). | Admin → Finance → Profit & Ads |

## Accounting rules
* Delivered revenue comes from orders (already in Accounts). Courier module never adds revenue.
* Company-paid courier charges are expenses and are deducted from the COD the courier remits; customer-paid charges are neither.
* Expected remittance = COD collected − company-paid delivery − company-paid return. Outstanding = expected − received.
* **Actual** profit uses only recorded product costs, VERIFIED courier costs, recorded expenses and ad costs marked *Actual*. *Estimated* and *Unverified* are shown as separate lines. If any delivered order has no recorded product cost, profit is shown as "Not available" (never guessed).
* Shared ad cost is split by each product's share of delivered revenue (stated on screen). Courier/payroll costs are not allocated to products.
* Manual "Delivery Cost" expenses linked to an order that a verified courier record also posts are flagged as possible double counting; synced expenses cannot be edited/deleted from the Expenses screen.

## Deployment notes
* Two new Firestore collections: `courier_ledger`, `ad_costs` (server-only; `firestore.rules` updated, deny-all to clients like the others). Nothing to create manually.
* No new dependencies, env vars or Netlify settings.
