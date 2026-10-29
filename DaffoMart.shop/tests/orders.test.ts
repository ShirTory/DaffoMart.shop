import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
const { db, newId } = await import("@/server/db");
const { createOrder, setOrderStatus, setPaymentStatus, getZones } = await import("@/server/services");

const zone = (await getZones())[0];
const mkProduct = async (stock: number, over: Record<string, unknown> = {}) => {
  const id = newId();
  await db.put("products", { id, slug: id, name: `P-${id.slice(0, 4)}`, description: "", price: 100, unit: "1 pc", emoji: "📦", images: [], categoryId: "x", stock, rating: 0, sold: 0, featured: false, active: true, createdAt: "", updatedAt: "", ...over } as any);
  return id;
};
const base = { name: "Test Buyer", phone: "01712345678", address: "House 1, Road 2, Dhaka", zone: zone.id, payment: "cod", note: "" };
const stockOf = async (id: string) => (await db.get<any>("products", id))!.stock;
const ordersCount = async () => (await db.list("orders")).length;

test("order decrements stock, increments sold and stores server-side prices", async () => {
  const id = await mkProduct(10);
  const o = await createOrder({ ...base, items: [{ id, qty: 3 }] } as any);
  assert.equal(await stockOf(id), 7);
  assert.equal((await db.get<any>("products", id))!.sold, 3);
  assert.equal(o.subtotal, 300);
  assert.equal(o.total, 300 + o.delivery + (o.serviceCharge ?? 0) - o.discount);
  assert.match(o.orderNo, /^DM-[A-HJ-NP-Z2-9]{7}$/);
});

test("same idempotency key twice => ONE order, stock decremented once", async () => {
  const id = await mkProduct(5);
  const before = await ordersCount();
  const key = "k".repeat(8) + "abcdef0123456789";
  const a = await createOrder({ ...base, idempotencyKey: key, items: [{ id, qty: 2 }] } as any);
  const b = await createOrder({ ...base, idempotencyKey: key, items: [{ id, qty: 2 }] } as any);
  assert.equal(a.id, b.id);
  assert.equal(a.orderNo, b.orderNo);
  assert.equal(await ordersCount(), before + 1);
  assert.equal(await stockOf(id), 3);
});

test("a retry after the product sold out still returns the original order (not 'out of stock')", async () => {
  const id = await mkProduct(1);
  const key = "retry-after-soldout-0123456789";
  const a = await createOrder({ ...base, idempotencyKey: key, items: [{ id, qty: 1 }] } as any);
  assert.equal(await stockOf(id), 0);
  const b = await createOrder({ ...base, idempotencyKey: key, items: [{ id, qty: 1 }] } as any);
  assert.equal(b.orderNo, a.orderNo);
});

test("10 concurrent buyers, 3 units in stock => exactly 3 orders, stock never negative", async () => {
  const id = await mkProduct(3);
  const before = await ordersCount();
  const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => createOrder({ ...base, idempotencyKey: `concurrent-${i}-0123456789abcdef`, items: [{ id, qty: 1 }] } as any)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  for (const r of results) if (r.status === "rejected") assert.equal((r.reason as any).status, 409);
  assert.equal(await stockOf(id), 0);
  assert.equal(await ordersCount(), before + 3);
});

test("a failing line rolls the whole order back: no order, no partial stock change", async () => {
  const ok = await mkProduct(10); const scarce = await mkProduct(1);
  const before = await ordersCount();
  await assert.rejects(createOrder({ ...base, items: [{ id: ok, qty: 2 }, { id: scarce, qty: 5 }] } as any), (e: any) => e.status === 409 && /Only 1/.test(e.message));
  assert.equal(await stockOf(ok), 10);
  assert.equal(await stockOf(scarce), 1);
  assert.equal(await ordersCount(), before);
});

test("inactive and unknown products are refused", async () => {
  const off = await mkProduct(10, { active: false });
  await assert.rejects(createOrder({ ...base, items: [{ id: off, qty: 1 }] } as any), (e: any) => e.status === 400);
  await assert.rejects(createOrder({ ...base, items: [{ id: "nope", qty: 1 }] } as any), (e: any) => e.status === 400);
});

test("cancelling returns stock exactly once; re-opening takes it back", async () => {
  const id = await mkProduct(10);
  const o = await createOrder({ ...base, items: [{ id, qty: 4 }] } as any);
  await setOrderStatus(o.id, "cancelled"); assert.equal(await stockOf(id), 10);
  await setOrderStatus(o.id, "returned");  assert.equal(await stockOf(id), 10); // no double restore
  await setOrderStatus(o.id, "pending");   assert.equal(await stockOf(id), 6);
});

test("deliveredAt is set once on delivery and survives later edits (revenue date must not drift)", async () => {
  const id = await mkProduct(10);
  const o = await createOrder({ ...base, items: [{ id, qty: 1 }] } as any);
  const d = await setOrderStatus(o.id, "delivered");
  assert.ok(d.deliveredAt);
  assert.equal(d.paymentStatus, "paid"); // COD is collected on delivery
  await new Promise((r) => setTimeout(r, 15));
  const after = await setPaymentStatus(o.id, "paid");
  assert.equal(after.deliveredAt, d.deliveredAt);
  assert.notEqual(after.updatedAt, d.updatedAt);
});
