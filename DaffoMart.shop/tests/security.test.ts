import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
const { db, newId } = await import("@/server/db");
const { createOrder, setOrderStatus, getZones, getSettings } = await import("@/server/services");
const { productCfg, stripCost } = await import("@/server/resources");

const zone = (await getZones())[0];
const mkProduct = async (stock: number, over: Record<string, unknown> = {}) => {
  const id = newId();
  await db.put("products", { id, slug: id, name: `P-${id.slice(0, 4)}`, description: "", price: 100, unit: "1 pc", emoji: "📦", images: [], categoryId: "x", stock, rating: 0, sold: 0, featured: false, active: true, createdAt: "", updatedAt: "", ...over } as any);
  return id;
};
const base = { name: "Test Buyer", phone: "01712345678", address: "House 1, Road 2, Dhaka", zone: zone.id, note: "" };

// make bKash available
const s = await getSettings();
await db.put("settings", { ...s, id: "store", payBkash: true, bkashNumber: "01700000000" } as any);

test("the same bKash TrxID cannot be used for two live orders; a cancelled order frees it", async () => {
  const id = await mkProduct(10);
  const pay = { payment: "bkash", paymentRef: "9A7B6C5D4E", paymentFrom: "01812345678" };
  const a = await createOrder({ ...base, ...pay, items: [{ id, qty: 1 }] } as any);
  await assert.rejects(() => createOrder({ ...base, ...pay, paymentRef: "9a7b6c5d4e", items: [{ id, qty: 1 }] } as any), (e: any) => e.status === 409);
  await setOrderStatus(a.id, "cancelled");
  const b = await createOrder({ ...base, ...pay, items: [{ id, qty: 1 }] } as any);
  assert.notEqual(a.id, b.id);
});

test("purchase cost never reaches the public (product list/detail + storefront cache)", () => {
  const p: any = { id: "1", name: "X", cost: 42, price: 60 };
  assert.equal("cost" in stripCost(p), false);
  assert.equal("cost" in productCfg.publicPresent(p), false);
  assert.equal(p.cost, 42, "original record is untouched (admin still sees it)");
});

// ---- session revocation after a password change ----
const { sessionRevoked } = await import("@/server/riderAuth");
test("a session issued before the password changed is revoked; a newer one is not", () => {
  const changed = new Date(Date.now() - 5_000).toISOString();
  const issuedBefore = Math.floor((Date.now() - 60_000) / 1000), issuedAfter = Math.floor(Date.now() / 1000);
  assert.equal(sessionRevoked(issuedBefore, changed), true);
  assert.equal(sessionRevoked(issuedAfter, changed), false);
  assert.equal(sessionRevoked(undefined, changed), true, "fail closed when iat is missing");
  assert.equal(sessionRevoked(issuedBefore, undefined), false, "no password change recorded");
});

// ---- atomic stock movement + cancel idempotency ----
test("cancelling twice (even at the same instant) returns stock exactly once", async () => {
  const id = await mkProduct(10);
  const o = await createOrder({ ...base, payment: "cod", items: [{ id, qty: 4 }] } as any);
  await Promise.all([setOrderStatus(o.id, "cancelled"), setOrderStatus(o.id, "cancelled"), setOrderStatus(o.id, "returned")]);
  assert.equal((await db.get<any>("products", id))!.stock, 10);
  assert.equal((await db.get<any>("products", id))!.sold, 0);
});

test("concurrent db.update calls on one document never lose a write", async () => {
  const id = await mkProduct(0);
  await Promise.all(Array.from({ length: 25 }, () => db.mutate<any>("products", id, (p) => ({ ...p, stock: p.stock + 1 }))));
  assert.equal((await db.get<any>("products", id))!.stock, 25);
});

// ---- payments fail closed in production ----
const { testGateway } = await import("@/server/gateways/test");
test("the sandbox payment gateway is OFF in production even if PAYMENT_TEST_MODE=true", () => {
  const keep = { ...process.env };
  process.env.PAYMENT_TEST_MODE = "true";
  (process.env as any).NODE_ENV = "production"; delete process.env.ALLOW_PAYMENT_TEST_IN_PRODUCTION;
  assert.equal(testGateway.isConfigured(), false);
  process.env.ALLOW_PAYMENT_TEST_IN_PRODUCTION = "true";
  assert.equal(testGateway.isConfigured(), true, "only with an explicit second switch");
  (process.env as any).NODE_ENV = "test"; process.env.PAYMENT_TEST_MODE = "true";
  assert.equal(testGateway.isConfigured(), true, "still usable in development/test");
  Object.assign(process.env, keep); delete process.env.PAYMENT_TEST_MODE; delete process.env.ALLOW_PAYMENT_TEST_IN_PRODUCTION; (process.env as any).NODE_ENV = keep.NODE_ENV;
});

// ---- production must not run on throw-away storage ----
const { storageProblem } = await import("@/server/db");
test("production on a serverless host without Firebase is reported as a storage problem", () => {
  const keep = { ...process.env };
  (process.env as any).NODE_ENV = "production"; process.env.NETLIFY = "true"; delete process.env.NEXT_PHASE; delete process.env.DATA_DIR; delete process.env.ALLOW_EPHEMERAL_STORAGE;
  delete process.env.FIREBASE_CLIENT_EMAIL; delete process.env.FIREBASE_PRIVATE_KEY;
  assert.match(storageProblem(), /Firebase is not configured/);
  process.env.NEXT_PHASE = "phase-production-build";
  assert.equal(storageProblem(), "", "the build itself must not fail");
  for (const k of ["NODE_ENV", "NETLIFY", "NEXT_PHASE", "DATA_DIR", "ALLOW_EPHEMERAL_STORAGE", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]) { if (keep[k] === undefined) delete (process.env as any)[k]; else (process.env as any)[k] = keep[k]; }
});

// ---- production configuration checklist ----
const { productionProblems } = await import("@/server/envCheck");
test("production config check flags weak / unsafe settings and never prints secret values", () => {
  const bad = productionProblems({ NODE_ENV: "production", ADMIN_EMAIL: "a@b.c", ADMIN_PASSWORD: "short", AUTH_SECRET: "tooshort-secret-value", PAYMENT_TEST_MODE: "true", ALLOW_PAYMENT_TEST_IN_PRODUCTION: "true", NEXT_PUBLIC_SITE_URL: "http://x.test", NEXT_PUBLIC_FIREBASE_PRIVATE_KEY: "-----BEGIN" } as any);
  const text = bad.join("\n");
  for (const must of ["ADMIN_PASSWORD is shorter", "AUTH_SECRET is shorter", "https://", "ALLOW_PAYMENT_TEST_IN_PRODUCTION", "NEXT_PUBLIC_FIREBASE_PRIVATE_KEY is public"]) assert.ok(text.includes(must), must);
  assert.equal(text.includes("tooshort-secret-value") || text.includes("short\n"), false);
});
