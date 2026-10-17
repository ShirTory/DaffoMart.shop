// Shared by middleware (edge) and route handlers. Keep free of Node-only imports.
export const COOKIE_NAME = "dm_admin";
export const RIDER_COOKIE = "dm_rider";
export const EMPLOYEE_COOKIE = "dm_employee";
export const SESSION_SECONDS = 60 * 60 * 12;

export function getSecret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-secret-change-me-daffomart-2026" : "");
  return s ? new TextEncoder().encode(s) : null;
}
