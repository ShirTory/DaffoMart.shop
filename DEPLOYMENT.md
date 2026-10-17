# Deploy on Netlify (or Vercel) — permanent data via Firebase

## Is Firebase set up?
The code already supports Firebase (Firestore database + Storage for images) — but **it only turns on when the 4 FIREBASE_* variables are filled**.
Without them the site works, but data/uploads are temporary (a yellow warning shows on the admin dashboard).
Check any time in **Admin → Settings & Contact → Database & storage → Test connection**.

## One-time Firebase setup
1. https://console.firebase.google.com → *Add project*.
2. Build → **Firestore Database** → Create database (production mode). Build → **Storage** → Get started.
3. Project settings → **Service accounts** → *Generate new private key* → download the JSON.
4. Vercel → Project → Settings → Environment Variables (also put the same values in `.env.local` to run locally):
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (strong!), `AUTH_SECRET` (random 32+ chars, e.g. `openssl rand -hex 32`)
   - `FIREBASE_PROJECT_ID` = `project_id`, `FIREBASE_CLIENT_EMAIL` = `client_email`,
     `FIREBASE_PRIVATE_KEY` = `private_key` (in quotes, keep the `\n`), `FIREBASE_STORAGE_BUCKET` = e.g. `your-project.firebasestorage.app`
5. Redeploy → open `https://YOUR-SITE/admin/login` → Settings → **Test connection** (both Firestore and Storage must say Working).
6. Firestore and Storage are used only by the server, so deny all client access. Firestore rules:
   `rules_version='2'; service cloud.firestore { match /databases/{d}/documents { match /{doc=**} { allow read, write: if false; } } }`
   Storage rules: images are served through secret download links, so also use `allow read, write: if false;`.

Collections are created automatically on first use: products, categories, banners, offers, orders, settings, zones, riders, stocklogs, nid, images. No indexes are required.

## First start
Demo categories/products (grocery + medicine) and two delivery areas are created automatically — edit or delete them in the admin panel.

## Live map key (optional)
For the interactive live map add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel → Environment Variables and redeploy (the value is public by design, so restrict it by HTTP referrer in Google Cloud and enable only Maps JavaScript API + Directions API). Without it the map still works through the free keyless embed.
Riders need HTTPS for GPS — Vercel gives you that. On a phone the rider must allow location for the site.


---
# Netlify deployment (step by step)
Netlify detects Next.js by itself (no plugin to install). `netlify.toml` in this project sets Node 22 and tells the secret scanner to ignore the public Maps key.
1. Push the project to GitHub (**never** commit `.env.local` or the Firebase JSON — `.gitignore` already skips `.env.local`).
2. Netlify → *Add new site → Import an existing project* → pick the repo. Build command `npm run build` (auto-filled). Do not deploy yet.
3. *Site configuration → Environment variables* → add every variable from `.env.example` (ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_SECRET, the 4 FIREBASE_*, NEXT_PUBLIC_SITE_URL = your https site URL, optional NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Mark ADMIN_PASSWORD, AUTH_SECRET and FIREBASE_PRIVATE_KEY as **secret**. Paste FIREBASE_PRIVATE_KEY on ONE line with the `\n` characters kept.
4. *Deploys → Trigger deploy*. Open `https://YOUR-SITE.netlify.app/admin/login` → Settings → **Test connection** (Firestore + Storage must both say OK).
5. HTTPS is automatic (free certificate) on `*.netlify.app` and on your own domain once DNS points to Netlify. The rider app needs HTTPS for GPS — you already have it.
Without Firebase, Netlify cannot keep data (its disk is read-only/temporary): the site will look fine but orders and uploads disappear.
Uploads are limited to 4 MB per image because serverless request bodies are capped.

## No billing card? Skip Firebase Storage
Firebase Storage needs a Blaze (billing) account. You can skip it: leave `FIREBASE_STORAGE_BUCKET` **empty** and the site saves product/banner images inside Firestore (works on the free Spark plan). Images are auto-compressed to under ~700 KB each. Settings → *Test connection* then shows "Not used — images are saved in the Firestore database". Add a bucket later and the old images keep working.


## SEO & sharing setup (after deploying)
- `NEXT_PUBLIC_SITE_URL` **must** be your real public https address (custom domain once connected). It is used for canonical URLs, `sitemap.xml`, `robots.txt`, Open Graph/Twitter images and Schema.org data. Redeploy after changing it.
- Optional: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` = the token from Google Search Console (HTML-tag method) adds the verification tag automatically.
- Submit `https://YOUR-SITE/sitemap.xml` in Google Search Console. `robots.txt` blocks `/admin`, `/rider`, `/api/` (except product photos in `/api/uploads/`), cart, checkout and tracking.
- Default share image: `public/og-default.png` (1200x630). Product pages use the product photo; category pages use the category photo.
- Product/category photos are uploaded in **Admin → Products / Categories** (JPG/PNG/WebP, auto-converted to WebP). Shop-by-category tiles and product cards show the uploaded photo and fall back to the emoji when there is none.

## Rider applications
Riders apply at `/rider/register` (name, mobile, password, permanent + present address, referrer, NID front + back). Admin → Riders → **Applications** shows them; open one to view the NID photos (served only to a signed-in admin through `/api/riders/:id/nid/front|back`, never public, never cached), then **Approve** or **Reject** (a reason is required). Only approved riders can sign in or use `/api/rider/*`. NID photos are stored privately in the Firestore `nid` collection (or `.data/db.json` when running without Firebase), never in the public image storage. The browser shrinks each photo before upload and the server compresses it again; each must be under 2.5 MB. A rejected applicant can apply again with the same mobile number. New applications show a counter next to **Riders** in the admin menu.

## Speed
Storefront pages and product data are cached (`src/server/queries.ts`) and refresh immediately when the admin saves a product, category, banner, offer, setting or delivery area (and at most every 60 seconds otherwise). Orders and the admin panel always read live data. Product photos are served resized by the Next.js image optimizer. Because the home, contact and product pages are pre-rendered, the first `npm run build` reads the database once: set the FIREBASE_* variables before the first deploy.
