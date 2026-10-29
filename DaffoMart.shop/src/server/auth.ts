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
  const a = safeEq(email.toLowerCase(), c.email.toLowerCase());
  const b = safeEq(password, c.password);
  return a && b;
}

export type AdminSession = {
  email: string;
  /** owner = env Super Admin; it_support = granted IT account */
  adminRole: "owner" | "it_support" | "accountant";
  fullAccess: boolean;
};

export async function createSessionCookie(email: string, meta?: { adminRole?: "owner" | "it_support" | "accountant"; fullAccess?: boolean }) {
  const secret = getSecret();
  if (!secret) throw new ApiError(503, "AUTH_SECRET is not configured.");
  const adminRole = meta?.adminRole || "owner";
  const fullAccess = meta?.fullAccess !== false;
  const token = await new SignJWT({ role: "admin", adminRole, fullAccess })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}
export async function clearSessionCookie() { (await cookies()).delete(COOKIE_NAME); }

/** True when `email` is the Owner configured through ADMIN_EMAIL. */
const isEnvOwner = (email: string) => { const c = adminCredentials(); return Boolean(c && c.email.toLowerCase() === email.trim().toLowerCase()); };

/**
 * The signed-in admin. The JWT only proves *who* signed in; role and access level are re-read from the
 * `admins` collection on every call, so deactivating or demoting an account takes effect immediately
 * instead of when the 12-hour token expires. Any lookup failure denies access (fail closed).
 */
export async function getAdmin(): Promise<AdminSession | null> {
  const secret = getSecret();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== "admin" || !payload.sub) return null;
    const email = String(payload.sub);
    if (isEnvOwner(email)) return { email, adminRole: "owner", fullAccess: true };
    const { findAdminByEmail } = await import("./adminAccounts");
    const acc = await findAdminByEmail(email); // only returns active accounts
    if (!acc) return null;
    const { sessionRevoked } = await import("./riderAuth");
    if (sessionRevoked(payload.iat, acc.pwChangedAt)) return null; // password changed after this session was issued
    return { email: acc.email, adminRole: acc.role, fullAccess: acc.role === "owner" ? true : acc.role === "accountant" ? false : Boolean(acc.fullAccess) };
  } catch (e) {
    console.error("[auth] session check failed", e);
    return null;
  }
}

/** The signed-in admin ONLY if they have full Admin Panel access (null for Accountant / diagnostics-only IT accounts). Use for "admin sees more than the public" reads. */
export async function getFullAdmin(): Promise<AdminSession | null> {
  const a = await getAdmin();
  return a && a.fullAccess ? a : null;
}

/** Any valid admin session, including an IT Support account that has NOT been granted full access (diagnostics only). */
export async function requireSession() {
  const a = await getAdmin();
  if (!a) throw new ApiError(401, "Please sign in as admin");
  return a;
}

/**
 * Full Admin Panel access: the Owner, or IT Support explicitly granted `fullAccess`.
 * Use this for every route that reads or changes business data (orders, products, settings, finance, uploads …).
 */
export async function requireAdmin() {
  const a = await requireSession();
  if (!a.fullAccess) throw new ApiError(403, "Your account does not have Admin Panel access. Ask the Owner to grant it.");
  return a;
}

/** Alias kept for existing audit/SKU routes; identical to requireAdmin(). */
export const requireFullAdmin = requireAdmin;

/**
 * Finance & Accounts: the Owner, a full-access IT Support account, or an Accountant.
 * An Accountant passes ONLY this guard; every other route uses requireAdmin() and answers 403 to them.
 */
export async function requireFinance() {
  const a = await requireSession();
  if (!a.fullAccess && a.adminRole !== "accountant") throw new ApiError(403, "Your account does not have Finance access.");
  return a;
}

/** Only env Super Admin / Owner role */
export async function requireOwner() {
  const a = await requireSession();
  if (a.adminRole !== "owner") throw new ApiError(403, "Only the Owner can perform this action");
  return a;
}

/** Try env owner credentials, then IT Support accounts in `admins` collection */
export async function authenticateAdmin(email: string, password: string): Promise<AdminSession | null> {
  if (adminCredentials() && checkCredentials(email, password)) {
    return { email: email.trim().toLowerCase(), adminRole: "owner", fullAccess: true };
  }
  try {
    const { findAdminByEmail } = await import("./adminAccounts");
    const { verifyPassword } = await import("./riderAuth");
    const acc = await findAdminByEmail(email);
    if (!acc || !acc.active || !acc.passHash) return null;
    if (!verifyPassword(password, acc.passHash)) return null;
    // An IT Support account without fullAccess may sign in but is limited to diagnostics (see requireAdmin).
    return {
      email: acc.email,
      adminRole: acc.role,
      fullAccess: acc.role === "owner" ? true : acc.role === "accountant" ? false : !!acc.fullAccess,
    };
  } catch (e) {
    console.error("[auth] admin account lookup failed", e);
    return null;
  }
}
