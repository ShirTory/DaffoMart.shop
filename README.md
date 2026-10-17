# DaffoMart

Next.js 15 + TypeScript + Tailwind. Storefront (English) + professional admin dashboard + REST API.

## Run locally
    npm install
    npm run dev          # http://localhost:3000
Admin: http://localhost:3000/admin/login — login is in `.env.local` (ADMIN_EMAIL / ADMIN_PASSWORD).
In production set ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_SECRET on the host. Without Firebase, data is saved in `.data/`.

## Admin dashboard
Dashboard (sales chart, top products, low stock) · Orders (status, **rider assignment**, invoice print) · Products (multi-image upload, medicine fields) ·
Categories (grocery / **medicine** type) · **Inventory** (stock levels + history) · **Delivery Areas** (charge per area) · **Riders** ·
**Cover Images** · **Offers & Coupons** · **Website Content** (logo, banner text, medicine section, highlights) · Settings & Contact (+ Firebase test).

## REST API (JSON `{ok, data}` / `{ok:false, error}`)
Public: `GET /api/products` (q, cat, sort, min, max, sale, featured, limit, page) · `/api/products/:id` · `/api/categories` ·
`/api/banners` · `/api/offers` · `/api/settings` · `POST /api/orders` · `GET /api/orders/track?no=&phone=` · `POST /api/coupons/validate`
Admin (cookie session): `POST/PUT/DELETE` on products, categories, banners, offers · `PUT /api/settings` ·
`GET/PATCH/DELETE /api/orders[/:id]` · `POST /api/upload` (multipart `file`, `kind`) · `GET /api/admin/stats`
Security: signed HttpOnly session cookie, server-side validation (zod), prices/stock/coupon recomputed on the server,
images verified & converted to WebP, rate limits on login/orders.

## Rider app (`/rider`)
New riders apply at `/rider/register` (name, mobile, password, NID number, permanent + present address, referrer, NID front + back photo); an admin approves or rejects them in **Admin → Riders → Applications** (see `DEPLOYMENT.md`). Only approved riders can sign in.
Riders sign in at `/rider/login` (phone + password set in Admin → Riders). They see only their own orders and can:
- switch on **Share live location** (GPS is sent to the server every few seconds; turns on automatically when they press *Start delivery*),
- see their own position and every customer's pin on a **Map** tab, plus the distance to each customer and a route map inside each order,
- call the customer, open **Navigate** (Google Maps turn-by-turn), update status, and see the cash to collect.
A web page cannot track in the background: the rider keeps the page open with the screen on (the app asks the phone to stay awake).

## Live tracking
- **Customer** (`/track`): once the rider has picked up the parcel, the page shows a live map (rider 🛵 + customer 🏠), distance and a rough ETA, refreshing every 10 s. The rider is shown only while he is delivering that order.
- **Admin → Live Map**: every rider who is sharing, plus the customers they are delivering to.
- A customer pin exists only if the customer pressed *Use my current location* at checkout.

## Payments
COD + manual bKash/Nagad + an **Online payment** option. Online payment is already on the checkout page: it shows as *Coming soon* until a gateway is connected. See `PAYMENTS.md`.

## Google Maps
Works with **no API key** (keyless embed: route/pin that refreshes). For the smooth interactive live map add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (see `.env.example`).
