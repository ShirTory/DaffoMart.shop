import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
const { db, newId } = await import("@/server/db");
const fin = await import("@/server/finance");
const cr = await import("@/server/courier");
const an = await import("@/server/analytics");

let n = 0;
const mkOrder = async (o: Record<string, unknown> = {}) => {
  const id = newId();
  const rec = { id, orderNo: `DM-C${++n}`, name: "A", phone: "01712345678", address: "x", zone: "z", payment: "cod", paymentStatus: "paid", note: "", items: [{ id: "p1", name: "Rice", unit: "1kg", price: 100, qty: 2, cost: 60 }], subtotal: 200, delivery: 60, serviceCharge: 0, discount: 0, total: 260, status: "delivered", deliveredAt: "2026-09-10T06:00:00.000Z", createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-10T06:00:00.000Z", courierId: "c1", courierName: "Pathao", trackingNo: "T1", ...o };
  await db.put("orders", rec as any); return rec as any;
};
const NOW = "2026-09-11T00:00:00.000Z";

test("parcel maths: company-paid charges are deducted from the COD remittance, customer-paid are not", async () => {
  const o = await mkOrder();
  const a = cr.computeParcel(o, cr.applyParcelEdit(o, null, { deliveryCharge: 80, deliveryChargePaidBy: "company", amountReceived: 150 }, "t", NOW));
  assert.equal(a.codCollected, 260); assert.equal(a.expectedRemittance, 180); assert.equal(a.outstanding, 30); assert.equal(a.deliveryExpense, 80); assert.equal(a.returnLoss, 0);
  const b = cr.computeParcel(o, cr.applyParcelEdit(o, null, { deliveryCharge: 80, deliveryChargePaidBy: "customer", amountReceived: 260 }, "t", NOW));
  assert.equal(b.expectedRemittance, 260); assert.equal(b.outstanding, 0); assert.equal(b.deliveryExpense, 0);
});

test("a returned parcel collects nothing; its company charges are a return loss", async () => {
  const o = await mkOrder({ status: "returned", deliveredAt: undefined });
  const r = cr.computeParcel(o, cr.applyParcelEdit(o, null, { deliveryCharge: 70, returnStatus: "returned", returnCharge: 40, returnChargePaidBy: "company" }, "t", NOW));
  assert.equal(r.codCollected, 0); assert.equal(r.deliveredRevenue, 0); assert.equal(r.returnLoss, 110); assert.equal(r.deliveryExpense, 0); assert.equal(r.expectedRemittance, -110);
});

test("validation: no negative / absurd numbers, received <= COD, return charge needs a return status", async () => {
  const o = await mkOrder();
  assert.throws(() => cr.applyParcelEdit(o, null, { deliveryCharge: -5 }, "t", NOW), /between 0/);
  assert.throws(() => cr.applyParcelEdit(o, null, { amountReceived: 999 }, "t", NOW), /cannot be more than the COD/);
  assert.throws(() => cr.applyParcelEdit(o, null, { returnCharge: 20 }, "t", NOW), /return status/);
  assert.throws(() => cr.applyParcelEdit(o, null, { deliveryCharge: "abc" }, "t", NOW), /between 0/);
});

test("editing a verified parcel needs a reason and every change is kept in the audit history", async () => {
  const o = await mkOrder();
  let rec = cr.applyParcelEdit(o, null, { deliveryCharge: 80, verified: true }, "alice", NOW);
  assert.equal(rec.audit.length, 1); assert.equal(rec.audit[0].action, "create");
  assert.throws(() => cr.applyParcelEdit(o, rec, { deliveryCharge: 90 }, "bob", NOW), /reason/);
  const next = cr.applyParcelEdit(o, rec, { deliveryCharge: 90, reason: "courier invoice corrected" }, "bob", "2026-09-12T00:00:00.000Z");
  assert.equal(next.audit.length, 2); assert.deepEqual(next.audit[1].changes.deliveryCharge, [80, 90]); assert.equal(next.audit[1].reason, "courier invoice corrected"); assert.equal(next.audit[1].by, "bob");
  assert.equal(cr.applyParcelEdit(o, next, { deliveryCharge: 90 }, "bob", NOW), next); // no change -> same record, no audit noise
});

test("verified parcels post ONE expense into Accounts; re-saving, correcting and un-verifying never duplicate or leave it behind", async () => {
  const o = await mkOrder({ deliveredAt: "2026-07-10T06:00:00.000Z" });
  const range = ["2026-07-01", "2026-07-31"] as const;
  const before = (await fin.profitLoss(...range)).expenseTotal;
  await cr.saveParcel(o.id, { deliveryCharge: 80 }, "t"); // not verified yet: nothing in Accounts
  assert.equal((await fin.profitLoss(...range)).expenseTotal, before);
  await cr.saveParcel(o.id, { verified: true }, "t");
  await cr.saveParcel(o.id, { verified: true }, "t"); // repeat: no change, no second expense
  await cr.saveParcel(o.id, { note: "x", reason: "typo" }, "t");
  assert.equal((await fin.profitLoss(...range)).expenseTotal, before + 80);
  assert.equal((await db.list<any>("finance_expenses")).filter((e) => e.id === `courier:${o.id}`).length, 1);
  await cr.saveParcel(o.id, { deliveryCharge: 95, reason: "invoice" }, "t");
  assert.equal((await fin.profitLoss(...range)).expenseTotal, before + 95);
  await assert.rejects(() => fin.updateExpense(`courier:${o.id}`, { amount: 1 }), /Courier Accounts/);
  await assert.rejects(() => fin.deleteExpense(`courier:${o.id}`), /Courier Accounts/);
  await cr.saveParcel(o.id, { verified: false, reason: "needs check" }, "t");
  assert.equal((await fin.profitLoss(...range)).expenseTotal, before);
  assert.equal((await cr.parcelHistory(o.id)).length >= 4, true);
});

test("a customer-paid charge posts nothing; an order without a courier cannot get a courier record", async () => {
  const o = await mkOrder({ deliveredAt: "2026-06-10T06:00:00.000Z" });
  await cr.saveParcel(o.id, { deliveryCharge: 80, deliveryChargePaidBy: "customer", verified: true }, "t");
  assert.equal(await db.get("finance_expenses", `courier:${o.id}`), null);
  const plain = await mkOrder({ courierId: undefined, courierName: undefined });
  await assert.rejects(() => cr.saveParcel(plain.id, { deliveryCharge: 1 }, "t"), /no courier/);
});

test("summary keeps verified and unverified receivables apart", async () => {
  const a = await mkOrder({ deliveredAt: "2026-05-10T06:00:00.000Z" }), b = await mkOrder({ deliveredAt: "2026-05-11T06:00:00.000Z" });
  await cr.saveParcel(a.id, { deliveryCharge: 60, amountReceived: 200, verified: true }, "t");
  await cr.saveParcel(b.id, { deliveryCharge: 60, amountReceived: 100 }, "t");
  const rows = await cr.courierRows("2026-05-01", "2026-05-31"); const s = cr.summarize(rows);
  assert.equal(s.delivered, 2); assert.equal(s.receivableVerified, 0); assert.equal(s.receivableUnverified, 100); assert.equal(s.unverifiedParcels, 1); assert.equal(s.amountReceived, 300);
});

test("ad costs: re-importing the same row updates it; one bad row saves nothing; USD is never invented", async () => {
  await db.put("products", { id: "p1", name: "Rice", active: true } as any);
  const r1 = await an.saveAdCosts([{ date: "2026-08-02", platform: "Facebook", campaign: "Eid", amountBdt: 1000, status: "actual" }, { date: "2026-08-02", platform: "Facebook", campaign: "Eid", productId: "p1", amountUsd: 10, usdRate: 120 }], "t");
  assert.equal(r1.created, 2);
  const r2 = await an.saveAdCosts([{ date: "2026-08-02", platform: "facebook", campaign: "EID", amountBdt: 1200, status: "actual" }], "t");
  assert.equal(r2.updated, 1); assert.equal((await an.listAdCosts("2026-08-01", "2026-08-31")).length, 2);
  const bad = await an.saveAdCosts([{ date: "2026-08-03", platform: "Google", campaign: "A", amountBdt: 50 }, { date: "2026-13-40", platform: "Google", campaign: "B", amountBdt: 50 }], "t");
  assert.equal(bad.saved, 0); assert.equal(bad.errors[0].row, 2); assert.equal((await an.listAdCosts("2026-08-01", "2026-08-31")).length, 2);
  const noRate = await an.saveAdCosts([{ date: "2026-08-04", platform: "Google", campaign: "C", amountUsd: 5 }], "t"); // USD with no rate and no taka amount: refused, not guessed
  assert.equal(noRate.saved, 0); assert.match(noRate.errors[0].message, /taka/);
  const ads = await an.listAdCosts("2026-08-01", "2026-08-31");
  assert.equal(ads.find((a) => a.productId === "p1")!.amountBdt, 1200); // 10 USD x 120 as supplied by the admin
});

test("product profit: tagged ads go to the product, shared ads are split by revenue and add up", () => {
  const mk = (id: string, price: number, qty: number, cost?: number) => ({ id: "o" + id + price, items: [{ id, name: id, unit: "", price, qty, ...(cost === undefined ? {} : { cost }) }], discount: 0 }) as any;
  const orders = [mk("A", 100, 3, 40), mk("B", 100, 1, 50), mk("C", 200, 1)];
  const ads = [{ id: "1", amountBdt: 100, productId: "A" }, { id: "2", amountBdt: 400 }] as any;
  const r = an.productProfits(orders, ads);
  const A = r.rows.find((x) => x.productId === "A")!, B = r.rows.find((x) => x.productId === "B")!, C = r.rows.find((x) => x.productId === "C")!;
  assert.equal(A.directAds, 100); assert.equal(A.sharedAds + B.sharedAds + C.sharedAds, 400); assert.equal(A.sharedAds, 200); // 300 of 600 revenue
  assert.equal(A.profit, 300 - 120 - 100 - 200); assert.equal(C.profit, null); assert.equal(C.costKnown, false);
});

test("analytics: unknown costs are never guessed; actual / estimated / unverified stay separate; cost per order", async () => {
  // a clean month: Oct 2026
  const mk = (cost?: number) => mkOrder({ deliveredAt: "2026-10-10T06:00:00.000Z", items: [{ id: "p1", name: "Rice", unit: "", price: 100, qty: 2, ...(cost === undefined ? {} : { cost }) }] });
  const o1 = await mk(60), o2 = await mk(60);
  await cr.saveParcel(o1.id, { deliveryCharge: 50, verified: true }, "t");
  await cr.saveParcel(o2.id, { deliveryCharge: 70 }, "t"); // unverified
  await an.saveAdCosts([{ date: "2026-10-05", platform: "Facebook", campaign: "A", amountBdt: 100, status: "actual" }, { date: "2026-10-06", platform: "Facebook", campaign: "B", amountBdt: 40, status: "estimated" }, { date: "2026-10-07", platform: "Facebook", campaign: "C", amountBdt: 20, amountUsd: 0.2, status: "unverified" }], "t");
  const a = await an.profitAnalytics("2026-10-01", "2026-10-31");
  assert.equal(a.deliveredOrders, 2); assert.equal(a.sales.revenue, 520);
  assert.equal(a.costs.cogs, 240); assert.equal(a.costs.courierVerified, 50); assert.equal(a.costs.courierUnverified, 70);
  assert.equal(a.profit.actual, 520 - 240 - 50 - 100); assert.equal(a.profit.withEstimatedAds, 520 - 240 - 50 - 140); assert.equal(a.profit.withEverything, 520 - 240 - 50 - 70 - 160);
  assert.equal(a.advertising.costPerOrder, 80); assert.equal(a.advertising.spendUsd, 0.2); assert.match(a.advertising.usdNote, /no USD/);
  await mkOrder({ deliveredAt: "2026-10-12T06:00:00.000Z", items: [{ id: "p1", name: "Rice", unit: "", price: 100, qty: 1 }] }); // no recorded cost
  const b = await an.profitAnalytics("2026-10-01", "2026-10-31");
  assert.equal(b.profit.actual, null); assert.equal(b.costs.cogs, null); assert.equal(b.costs.ordersWithoutCost, 1); assert.match(b.profit.note, /not reported/);
});
