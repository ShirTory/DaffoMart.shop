# Payments

## Working now
- **Cash on delivery** — marked *Paid* automatically when the rider marks the order delivered.
- **bKash / Nagad (manual)** — customer sends money to the number you set in *Admin → Payments*, enters the TrxID and the number they paid from. The order shows **Payment: Pending verification**; you check your bKash/Nagad app and press **Mark as paid** (or **Failed**) in the order.

## Adding a payment gateway later (SSLCommerz, AamarPay, bKash PGW, Nagad PGW …)
Everything is already wired: checkout option "Online payment", `POST /api/payments/online/init`, `GET|POST /api/payments/online/callback`, order `paymentStatus`.
You only add one adapter:

1. Create `src/server/gateways/<provider>.ts` exporting an object that implements `GatewayAdapter` (see `src/server/payments.ts`):
   - `isConfigured()` → true when the provider's env variables exist (store id, secret … — **never put secrets in code or the database**)
   - `init(order, origin)` → call the provider, return `{ url }` of the hosted payment page. Use `${origin}/api/payments/online/callback` as success/fail/IPN URL.
   - `callback(req)` → **verify** the provider's response with the provider's validation API, then return `{ orderNo, paid, ref }`.
2. Import it and add it to the `adapters` array in `src/server/payments.ts`.
3. Add the env variables on Vercel, redeploy, make sure *Admin → Payments → Online payment* is ON.

Until an adapter is configured the "Online payment" option is shown to customers as **Coming soon** (greyed out, cannot be selected, the server also rejects it), so nothing breaks.
Customers who start an online payment but do not finish can press **Pay now** on the Track page to retry.

## Try the whole flow now (sandbox)
Set `PAYMENT_TEST_MODE=true` (in `.env.local` or the host's environment variables) and restart. Checkout then sends the customer to a fake payment page
(`/pay/test`) with *Simulate successful / failed payment* buttons, and the order's payment status updates exactly like a real gateway would.
**No money moves and anyone can "pay" for free — never leave this on for real customers.** Remove the variable when you connect a real gateway.
