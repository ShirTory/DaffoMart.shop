# GitHub + Netlify — ঠিকভাবে আপলোড ও ডিপ্লয়

## কেন আগে fail হচ্ছিল
1. **`.gitignore` ছিল না** → `node_modules`, `.env`, `.next` গিটহাবে উঠে যেত বা push ভারী/ব্যর্থ হতো
2. **ZIP দুই ভাগে** → কিছু ফাইল মিস, ইমপোর্ট ভাঙা
3. **Netlify** → Next.js 15 এর জন্য অফিসিয়াল প্লাগইন লাগে; Node ভার্সন মিলিয়ে নিতে হয়
4. **Root folder** → GitHub-এ `Daffomart-main` এর *ভেতরের* ফাইলই রুটে থাকতে হবে (`package.json` রুটে)

## ধাপ ১ — লোকালে প্রজেক্ট খুলুন
```bash
unzip Daffomart-github-ready.zip
cd Daffomart-main
npm install
npm run build
```
`build` সফল হলেই Netlify-তেও কাজ করার সম্ভাবনা বেশি।

## ধাপ ২ — GitHub-এ push (সঠিক উপায়)
GitHub ওয়েবসাইটে ZIP ড্র্যাগ করে নয় — **Git** ব্যবহার করুন:

```bash
cd Daffomart-main
git init
git add .
git status
# নিশ্চিত করুন: node_modules, .env.local, .next তালিকায় নেই
git commit -m "DaffoMart ready for Netlify"
```

GitHub.com → **New repository** (খালি, README ছাড়া) → তারপর:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## ধাপ ৩ — Netlify
1. [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git → আপনার রিপো
2. **Base directory:** খালি রাখুন (যদি `package.json` রিপোর রুটে থাকে)
3. Build command: `npm run build` (অটো)
4. **Environment variables** যোগ করুন (Site settings → Environment variables):

| Key | উদাহরণ |
|-----|--------|
| `ADMIN_EMAIL` | আপনার ইমেইল |
| `ADMIN_PASSWORD` | শক্ত পাসওয়ার্ড |
| `AUTH_SECRET` | `openssl rand -hex 32` দিয়ে বানান |
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-SITE.netlify.app` |
| `FIREBASE_PROJECT_ID` | (ঐচ্ছিক কিন্তু Netlify-তে স্থায়ী ডেটার জন্য দরকার) |
| `FIREBASE_CLIENT_EMAIL` | |
| `FIREBASE_PRIVATE_KEY` | এক লাইনে, `\n` রাখুন |
| `FIREBASE_STORAGE_BUCKET` | খালি রাখলেও চলবে (ছবি Firestore-এ) |

5. Deploy → Trigger deploy
6. খুলুন: `https://YOUR-SITE.netlify.app/admin/login`

## বিল্ড আবার fail হলে
- Deploy log পড়ুন — সাধারণত missing env বা TypeScript error
- Node 20 সেট আছে কিনা (`netlify.toml`-এ আছে)
- রিপোর রুটে `package.json` আছে কিনা চেক করুন
- Firebase ছাড়াও বিল্ড হওয়ার কথা; শুধু ডেটা স্থায়ী থাকবে না

## গুরুত্বপূর্ণ
- কখনো `.env.local` বা Firebase JSON কমিট করবেন না
- `node_modules` কমিট করবেন না (`npm install` Netlify নিজে করে)
