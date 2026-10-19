import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
process.env.ADMIN_EMAIL = "owner@daffomart.test";
process.env.ADMIN_PASSWORD = "owner-password-123";
process.env.AUTH_SECRET = "y".repeat(40);

const { db, newId } = await import("@/server/db");
const { createSessionCookie } = await import("@/server/auth");
const { createRiderSession } = await import("@/server/riderAuth");
const ratings = await import("@/app/api/ratings/route");
const issues = await import("@/app/api/issues/route");
const callback = await import("@/app/api/payments/online/callback/route");
const productsApi = await import("@/app/api/products/route");
const track = await import("@/app/api/orders/track/route");

const jar = (j: Record<string, string> = {}) => ((globalThis as any).__testCookies = j);
const json = (url: string, method: string, body?: unknown) => new Request(`http://t.test${url}`, { method, headers: { "content-type": "application/json", "x-real-ip": "9.9.9." + Math.floor(Math.random() * 250) }, body: body ? JSON.stringify(body) : undefined });
const call = async (h: any, req: Request) => { const r: Response = await h(req); return { status: r.status, body: await r.json().catch(() => null) }; };

const riderId = newId(), orderId = newId();
await db.put("riders", { id: riderId, name: "Rana", phone: "01711111111", vehicle: "bike", area: "x", note: "", active: true, status: "approved", createdAt: "" } as any);
await db.put("orders", { id: orderId, orderNo: "DM-TEST1", name: "Buyer Name", phone: "01712345678", address: "x", zone: "z", items: [{ id: "p", name: "P", price: 100, qty: 1, cost: 60 }], subtotal: 100, deliveryFee: 0, discount: 0, total: 100, status: "delivered", payment: "cod", paymentStatus: "paid", riderId, createdAt: "2026-01-01T00:00:00Z", updatedAt: "" } as any);

test("rating: wrong or missing phone is refused; the right phone works once", async () => {
  jar();
  const bad = await call(ratings.POST, json("/api/ratings", "POST", { orderId, stars: 5, customerPhone: "01999999999" }));
  assert.equal(bad.status, 403);
  const none = await call(ratings.POST, json("/api/ratings", "POST", { orderId, stars: 5 }));
  assert.equal(none.status, 403);
  const good = await call(ratings.POST, json("/api/ratings", "POST", { orderId, stars: 4, customerPhone: "+8801712345678" }));
  assert.equal(good.status, 201);
  const again = await call(ratings.POST, json("/api/ratings", "POST", { orderId, stars: 1, customerPhone: "01712345678" }));
  assert.equal(again.status, 409);
});

test("public ratings list hides customer phone; an admin still sees it", async () => {
  jar();
  const pub = await call(ratings.GET, json(`/api/ratings?riderId=${riderId}`, "GET"));
  assert.equal(pub.status, 200);
  assert.ok(pub.body.data.length >= 1);
  assert.equal(JSON.stringify(pub.body).includes("01712345678"), false);
  await createSessionCookie("owner@daffomart.test", { adminRole: "owner", fullAccess: true });
  const adm = await call(ratings.GET, json(`/api/ratings?riderId=${riderId}`, "GET"));
  assert.equal(JSON.stringify(adm.body).includes("01712345678"), true);
});

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return new Request("http://t.test/api/issues", { method: "POST", headers: { "x-real-ip": "8.8.8." + Math.floor(Math.random() * 250) }, body: f }); };

test("issues: customer needs the order's phone; a rider must be signed in AND assigned; video is refused", async () => {
  jar();
  assert.equal((await call(issues.POST, form({ orderId, raisedBy: "customer", text: "Item was damaged", raiserPhone: "01800000000" }))).status, 403);
  assert.equal((await call(issues.POST, form({ orderId, raisedBy: "rider", text: "I am not the rider", raiserPhone: "01711111111" }))).status, 403, "anonymous caller claiming to be the rider");
  assert.equal((await call(issues.POST, form({ orderId, raisedBy: "customer", text: "Item was damaged", raiserPhone: "01712345678" }))).status, 201);
  jar(); await createRiderSession(riderId);
  assert.equal((await call(issues.POST, form({ orderId, raisedBy: "rider", text: "Customer not at home" }))).status, 201);
  const other = newId(); await db.put("riders", { id: other, name: "Other", phone: "01722222222", vehicle: "b", area: "x", note: "", active: true, status: "approved", createdAt: "" } as any);
  jar(); await createRiderSession(other);
  assert.equal((await call(issues.POST, form({ orderId, raisedBy: "rider", text: "Not my order" }))).status, 403, "a different rider");
  jar();
  const f = new FormData(); f.append("orderId", orderId); f.append("raisedBy", "customer"); f.append("text", "Item was damaged"); f.append("raiserPhone", "01712345678"); f.append("video", new File([new Uint8Array(10)], "v.mp4", { type: "video/mp4" }));
  assert.equal((await call(issues.POST, new Request("http://t.test/api/issues", { method: "POST", headers: { "x-real-ip": "7.7.7.7" }, body: f }))).status, 400);
});

test("online-payment callback: sandbox gateway is closed in production, so nobody can mark an order paid", async () => {
  const keep = process.env.NODE_ENV;
  const oid = newId();
  await db.put("orders", { id: oid, orderNo: "DM-PAY01", name: "B", phone: "01712345678", address: "x", zone: "z", items: [], subtotal: 100, deliveryFee: 0, discount: 0, total: 100, status: "pending", payment: "online", paymentStatus: "unpaid", createdAt: "", updatedAt: "" } as any);
  process.env.PAYMENT_TEST_MODE = "true"; (process.env as any).NODE_ENV = "production"; delete process.env.ALLOW_PAYMENT_TEST_IN_PRODUCTION;
  const res: Response = await (callback.GET as any)(new Request("http://t.test/api/payments/online/callback?no=DM-PAY01&result=success"));
  assert.equal(res.status, 503);
  assert.equal((await db.get<any>("orders", oid))!.paymentStatus, "unpaid");
  (process.env as any).NODE_ENV = keep; delete process.env.PAYMENT_TEST_MODE;
});

test("public product API and order tracking never expose purchase cost; admin can still read it", async () => {
  jar();
  const pid = newId();
  await db.put("products", { id: pid, slug: "rice-x", name: "Rice", description: "", price: 100, cost: 71, unit: "1kg", emoji: "🍚", images: [], categoryId: "x", stock: 5, rating: 0, sold: 0, featured: false, active: true, createdAt: "", updatedAt: "" } as any);
  const pub = await call(productsApi.GET, json("/api/products?limit=50", "GET"));
  assert.equal(JSON.stringify(pub.body).includes("\"cost\""), false);
  const t = await call(track.GET, json("/api/orders/track?no=DM-TEST1&phone=01712345678", "GET"));
  assert.equal(t.status, 200);
  assert.equal(JSON.stringify(t.body).includes("\"cost\""), false);
  await createSessionCookie("owner@daffomart.test", { adminRole: "owner", fullAccess: true });
  const adm = await call(productsApi.GET, json("/api/products?limit=50", "GET"));
  assert.equal(JSON.stringify(adm.body).includes("\"cost\":71"), true);
});
