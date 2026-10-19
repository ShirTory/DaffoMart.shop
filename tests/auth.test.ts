import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
process.env.ADMIN_EMAIL = "owner@daffomart.test";
process.env.ADMIN_PASSWORD = "owner-password-123";
process.env.AUTH_SECRET = "x".repeat(40);

const auth = await import("@/server/auth");
const { upsertAdmin } = await import("@/server/adminAccounts");
const { db } = await import("@/server/db");

const signInCookie = async (s: { email: string; adminRole: "owner" | "it_support" | "accountant"; fullAccess: boolean }) => {
  (globalThis as any).__testCookies = {};
  await auth.createSessionCookie(s.email, { adminRole: s.adminRole, fullAccess: s.fullAccess });
};
const signOut = () => { (globalThis as any).__testCookies = {}; };
const status = async (fn: () => Promise<unknown>) => { try { await fn(); return 200; } catch (e: any) { return e.status as number; } };

test("no cookie => 401 everywhere", async () => {
  signOut();
  assert.equal(await status(auth.requireSession), 401);
  assert.equal(await status(auth.requireAdmin), 401);
  assert.equal(await status(auth.requireOwner), 401);
});

test("Owner (env credentials) has full access", async () => {
  const s = await auth.authenticateAdmin("OWNER@daffomart.test", "owner-password-123");
  assert.deepEqual(s && { r: s.adminRole, f: s.fullAccess }, { r: "owner", f: true });
  assert.equal(await auth.authenticateAdmin("owner@daffomart.test", "wrong"), null);
  await signInCookie(s!);
  assert.equal(await status(auth.requireAdmin), 200);
  assert.equal(await status(auth.requireOwner), 200);
});

test("S1: IT Support WITHOUT fullAccess is refused by requireAdmin (orders, products, settings, uploads …) but may use diagnostics", async () => {
  await upsertAdmin({ email: "it@daffomart.test", role: "it_support", fullAccess: false, active: true, password: "it-password-123", grantedBy: "owner" });
  const s = await auth.authenticateAdmin("it@daffomart.test", "it-password-123");
  assert.deepEqual(s && { r: s.adminRole, f: s.fullAccess }, { r: "it_support", f: false });
  await signInCookie(s!);
  assert.equal(await status(auth.requireAdmin), 403);
  assert.equal(await status(auth.requireFullAdmin), 403);
  assert.equal(await status(auth.requireOwner), 403);
  assert.equal(await status(auth.requireSession), 200);
});

test("IT Support WITH fullAccess gets business access but is never the Owner", async () => {
  const acc = (await db.list<any>("admins")).find((a) => a.email === "it@daffomart.test");
  await upsertAdmin({ email: acc.email, role: "it_support", fullAccess: true, active: true, grantedBy: "owner" }, acc.id);
  await signInCookie({ email: acc.email, adminRole: "it_support", fullAccess: true });
  assert.equal(await status(auth.requireAdmin), 200);
  assert.equal(await status(auth.requireOwner), 403);
});

test("S2: a forged token claiming fullAccess/owner is ignored — access comes from the database", async () => {
  const acc = (await db.list<any>("admins")).find((a) => a.email === "it@daffomart.test");
  await upsertAdmin({ email: acc.email, role: "it_support", fullAccess: false, active: true, grantedBy: "owner" }, acc.id);
  await signInCookie({ email: acc.email, adminRole: "owner", fullAccess: true }); // token says owner+full
  const a = await auth.getAdmin();
  assert.equal(a?.adminRole, "it_support");
  assert.equal(a?.fullAccess, false);
  assert.equal(await status(auth.requireAdmin), 403);
  assert.equal(await status(auth.requireOwner), 403);
});

test("S2: revoking fullAccess or deactivating takes effect on the very next request (no waiting for token expiry)", async () => {
  const acc = (await db.list<any>("admins")).find((a) => a.email === "it@daffomart.test");
  await upsertAdmin({ email: acc.email, role: "it_support", fullAccess: true, active: true, grantedBy: "owner" }, acc.id);
  await signInCookie({ email: acc.email, adminRole: "it_support", fullAccess: true });
  assert.equal(await status(auth.requireAdmin), 200);
  await upsertAdmin({ email: acc.email, role: "it_support", fullAccess: false, active: true, grantedBy: "owner" }, acc.id);
  assert.equal(await status(auth.requireAdmin), 403, "revoked");
  await upsertAdmin({ email: acc.email, role: "it_support", fullAccess: true, active: false, grantedBy: "owner" }, acc.id);
  assert.equal(await status(auth.requireSession), 401, "deactivated");
});

test("S2: a deleted account's old token stops working", async () => {
  const acc = (await db.list<any>("admins")).find((a) => a.email === "it@daffomart.test");
  await upsertAdmin({ email: acc.email, role: "it_support", fullAccess: true, active: true, grantedBy: "owner" }, acc.id);
  await signInCookie({ email: acc.email, adminRole: "it_support", fullAccess: true });
  assert.equal(await status(auth.requireAdmin), 200);
  await db.remove("admins", acc.id);
  assert.equal(await status(auth.requireSession), 401);
});

test("inactive IT accounts cannot sign in; wrong password fails", async () => {
  await upsertAdmin({ email: "off@daffomart.test", role: "it_support", fullAccess: true, active: false, password: "off-password-123", grantedBy: "owner" });
  assert.equal(await auth.authenticateAdmin("off@daffomart.test", "off-password-123"), null);
  assert.equal(await auth.authenticateAdmin("it@daffomart.test", "not-the-password"), null);
});
