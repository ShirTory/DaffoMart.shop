import { requireSession } from "@/server/auth";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";

const has = (k: string) => Boolean(process.env[k]?.trim());
/** Admin only (sign in first): shows which environment variables are set, as true/false. Values are never shown. */
export const GET = handle(async () => {
  await requireSession();
  return ok({
    ADMIN_EMAIL: has("ADMIN_EMAIL"),
    ADMIN_PASSWORD: has("ADMIN_PASSWORD"),
    AUTH_SECRET: has("AUTH_SECRET"),
    AUTH_SECRET_long_enough: (process.env.AUTH_SECRET ?? "").length >= 32,
    FIREBASE_PROJECT_ID: has("FIREBASE_PROJECT_ID"),
    FIREBASE_CLIENT_EMAIL: has("FIREBASE_CLIENT_EMAIL"),
    FIREBASE_PRIVATE_KEY: has("FIREBASE_PRIVATE_KEY"),
    FIREBASE_PRIVATE_KEY_looks_valid: (process.env.FIREBASE_PRIVATE_KEY ?? "").includes("BEGIN PRIVATE KEY"),
    NEXT_PUBLIC_SITE_URL: has("NEXT_PUBLIC_SITE_URL"),
    host: process.env.NETLIFY ? "netlify" : process.env.VERCEL ? "vercel" : "other",
  });
});
