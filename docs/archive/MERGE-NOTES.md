# Final merged package (DaffoMart)

Base = the newer project ("Daffomart-final-2"): Appearance, Website Text, Invoice, Operations, Staff + Attendance, Courier services, SEO, favicons/manifest, mobile filter drawer.

Ported from the running (older) project so nothing is lost:
- **Custom payment methods** (Rocket, Upay, bank transfer …): Admin → Payments → "Custom payment methods"; shown at checkout and in the footer; TrxID + payer number can be required per method; the method's name is stored on the order (`paymentLabel`) and printed on invoices/admin/rider screens.
- **Meta (Facebook) Pixel**: Admin → Settings → Tracking → Meta Pixel ID (empty = off).
- **Employee "Department"** field.
- `/api/payment-methods` routes and the `payment_methods` collection.

Fixes while merging:
- `/policy` exists once (inside the store layout) – the old duplicate route was removed (it would break the build).
- Payment `enum` replaced by free string so custom method ids are accepted; unknown ids are still rejected.
- "Payments pending verification" counter on Operations now counts custom methods too.
- Old-format staff/courier records (fields `notes`, missing `charge` …) no longer crash the admin pages.

Checked: `npm ci`, `tsc --noEmit` (0 errors), `next build` (passes), live smoke test: custom method create → public list → order with/without TrxID → COD → invalid method rejected.
