# DaffoMart Upgrade Notes

## What was already solid (preserved)
- Next.js 15 + TypeScript + Tailwind + Firebase/local DB
- Product cards, cart, checkout, coupons, delivery zones
- Admin panel (products, categories, covers/banners, offers, orders, riders, settings)
- Dynamic promotional covers (desktop + mobile images, CTA, sort, active)
- Rider portal + live GPS tracking + admin live map
- Order tracking by order number + phone (rider name/phone shown when assigned)
- Payments: COD, bKash, Nagad, Online (gateway-ready)
- Stock validation, price recompute on server, rate limits

## Changes made in this upgrade
1. **Service charge** – `StoreSettings.serviceCharge` + included in order total (backend). Default 0. Editable via settings once UI is wired.
2. **2-minute cancellation** – `POST /api/orders/cancel` { no, phone }. Only pending orders, only within 2 minutes of `createdAt`. Stock restored via existing `setOrderStatus`.
3. **Wishlist** – `src/lib/wishlist.ts` (Zustand persist) + `/wishlist` page + mobile bottom-nav link.
4. **Mobile bottom navigation** – Home / Wishlist / Cart / Orders (Track). Safe-area aware.
5. **Loading screen** – Logo + brand name + shimmer bar instead of generic skeleton.
6. **Track API** – returns `serviceCharge` for display consistency.

## Still recommended (next stages)
- Wire service charge field in Admin → Settings UI
- Heart button on ProductCard to toggle wishlist
- Cancel button on Track page (call `/api/orders/cancel`) when status is pending and age < 2 min
- Show service charge line in CheckoutForm and Track summary
- OTP for track (optional; current phone+orderNo is already secure enough with rate limit)
- Notification center (can use announcement + offers already present)

## Deploy
```bash
npm install
# set env (see DEPLOYMENT.md / .env.example if present)
npm run build && npm start
# or Netlify / Vercel
```

Changed files (this pass):
- src/lib/types.ts
- src/server/seed.ts
- src/server/services.ts
- src/app/api/orders/track/route.ts
- src/app/api/orders/cancel/route.ts (new)
- src/lib/wishlist.ts (new)
- src/components/store/BottomNav.tsx (new)
- src/app/(store)/layout.tsx
- src/app/(store)/loading.tsx
- src/app/(store)/wishlist/page.tsx (new)
- src/app/globals.css (shimmer keyframe)
