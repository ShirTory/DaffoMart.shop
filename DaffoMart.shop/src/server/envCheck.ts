import { firebaseConfigured, storageProblem } from "./db";

/** Everything that must be fixed before the site takes real orders. Empty list = nothing wrong. (Never returns secret values.) */
export function productionProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const p: string[] = [];
  if (!env.ADMIN_EMAIL) p.push("ADMIN_EMAIL is not set.");
  if (!env.ADMIN_PASSWORD) p.push("ADMIN_PASSWORD is not set (owner cannot sign in).");
  else if (env.ADMIN_PASSWORD.length < 12) p.push("ADMIN_PASSWORD is shorter than 12 characters.");
  if (!env.AUTH_SECRET) p.push("AUTH_SECRET is not set (every login is refused).");
  else if (env.AUTH_SECRET.length < 32) p.push("AUTH_SECRET is shorter than 32 characters.");
  if (!env.NEXT_PUBLIC_SITE_URL) p.push("NEXT_PUBLIC_SITE_URL is not set (sitemap, canonical links and share cards are wrong).");
  else if (!/^https:\/\//.test(env.NEXT_PUBLIC_SITE_URL)) p.push("NEXT_PUBLIC_SITE_URL should start with https://.");
  const storage = storageProblem(); if (storage) p.push(storage);
  else if (!firebaseConfigured()) p.push("Firebase is not configured: data is stored on this machine only (fine for development, not for production).");
  if (env.PAYMENT_TEST_MODE === "true") p.push("PAYMENT_TEST_MODE=true is set. It is ignored in production, but remove it.");
  if (env.ALLOW_PAYMENT_TEST_IN_PRODUCTION === "true") p.push("ALLOW_PAYMENT_TEST_IN_PRODUCTION=true lets ANYONE mark online orders paid. Remove it.");
  if (env.SEED_DEMO === "true") p.push("SEED_DEMO=true creates demo products and fake sales counts. Remove it for a real store.");
  if (env.ALLOW_EPHEMERAL_STORAGE === "true") p.push("ALLOW_EPHEMERAL_STORAGE=true allows data loss on every cold start. Remove it.");
  for (const k of Object.keys(env)) if (k.startsWith("NEXT_PUBLIC_") && /(PRIVATE|SECRET|PASSWORD|CLIENT_EMAIL)/i.test(k)) p.push(`${k} is public (shipped to every browser). Never put a secret in a NEXT_PUBLIC_ variable.`);
  return p;
}
