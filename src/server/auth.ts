import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, SESSION_SECONDS, getSecret } from "./authConfig";
import { ApiError } from "./http";

const dev = process.env.NODE_ENV !== "production";
const sha = (s: string) => createHash("sha256").update(s).digest();
const safeEq = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

export function adminCredentials() {
  const email = process.env.ADMIN_EMAIL || (dev ? "admin@daffomart.com" : "");
  const password = process.env.ADMIN_PASSWORD || (dev ? "admin12345" : "");
  return email && password ? { email, password } : null;
}
export const usingDevCredentials = () => dev && !process.env.ADMIN_PASSWORD;

export function checkCredentials(email: string, password: string) {
  const c = adminCredentials();
  if (!c) throw new ApiError(503, "Admin login is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET.");
  // evaluate both to keep timing constant
  const a = safeEq(email.toLowerCase(), c.email.toLowerCase());
  const b = safeEq(password, c.password);
  return a && b;
}

export async function createSessionCookie(email: string) {
  const secret = getSecret();
  if (!secret) throw new ApiError(503, "AUTH_SECRET is not configured.");
  const token = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setSubject(email)
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(secret);
  (await cookies()).set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}
export async function clearSessionCookie() { (await cookies()).delete(COOKIE_NAME); }

export async function getAdmin(): Promise<{ email: string } | null> {
  const secret = getSecret(); const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!secret || !token) return null;
  try { const { payload } = await jwtVerify(token, secret); return payload.role === "admin" && payload.sub ? { email: payload.sub } : null; } catch { return null; }
}
export async function requireAdmin() {
  const a = await getAdmin();
  if (!a) throw new ApiError(401, "Please sign in as admin");
  return a;
}
