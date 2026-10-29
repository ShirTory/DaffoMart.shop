import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
const { db, newId } = await import("@/server/db");
const fin = await import("@/server/finance");

let n = 0;
const mkOrder = async (o: Record<string, unknown>) => {
  const id = newId();
  const rec = { id, orderNo: `DM-T${++n}`, name: "A", phone: "01712345678", address: "x", zone: "z", zoneName: "Z", payment: "cod", paymentStatus: "paid", note: "", items: [], subtotal: 0, delivery: 0, serviceCharge: 0, discount: 0, total: 0, status: "delivered", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", ...o };
  await db.put("orders", rec as any);
  return rec as any;
};

test("ymd uses Dhaka time (UTC+6), not UTC", () => {
  assert.equal(fin.ymd("2026-10-18T17:59:59.000Z"), "2026-10-18");
  assert.equal(fin.ymd("2026-10-18T18:00:00.000Z"), "2026-10-19"); // 00:00 in Dhaka
  assert.equal(fin.ymd("not a date"), "");
});

test("an order delivered at 02:00 Dhaka lands on that Dhaka day", async () => {
  await mkOrder({ id: "late-night", total: 500, deliveredAt: "2026-03-09T20:00:00.000Z" }); // = 2026-03-10 02:00 Dhaka
  const r = await fin.profitLoss("2026-03-10", "2026-03-10");
  assert.equal(r.incomeTotal, 500);
  assert.equal((await fin.profitLoss("2026-03-09", "2026-03-09")).incomeTotal, 0);
});

test("revenue date is deliveredAt: editing the order later does not move revenue to another month", async () => {
  await mkOrder({ total: 300, deliveredAt: "2026-04-10T06:00:00.000Z", updatedAt: "2026-06-20T06:00:00.000Z" }); // touched again in June
  assert.equal((await fin.profitLoss("2026-04-01", "2026-04-30")).incomeTotal, 300);
  assert.equal((await fin.profitLoss("2026-06-01", "2026-06-30")).incomeTotal, 0);
});

test("legacy delivered orders without deliveredAt fall back to updatedAt", async () => {
  await mkOrder({ total: 120, updatedAt: "2026-05-05T06:00:00.000Z" });
  assert.equal((await fin.profitLoss("2026-05-01", "2026-05-31")).incomeTotal, 120);
});

test("only delivered orders are revenue (cancelled / returned / in-flight are not)", async () => {
  for (const status of ["pending", "confirmed", "on_the_way", "cancelled", "returned"]) await mkOrder({ status, total: 999, updatedAt: "2026-07-07T06:00:00.000Z" });
  assert.equal((await fin.profitLoss("2026-07-01", "2026-07-31")).incomeTotal, 0);
});

test("P&L = income + manual income - expenses; categories add up", async () => {
  await mkOrder({ total: 1000, deliveredAt: "2026-08-02T06:00:00.000Z" });
  await fin.createIncome({ category: "Other Income", amount: 250.5, date: "2026-08-03", paymentMethod: "cash", note: "", createdBy: "t" } as any);
  await fin.createExpense({ category: "Rent", amount: 400.25, date: "2026-08-04", paymentMethod: "cash", note: "", createdBy: "t" } as any);
  await fin.createExpense({ category: "Rider pay", amount: 100, date: "2026-08-05", paymentMethod: "cash", note: "", createdBy: "t" } as any);
  const r = await fin.profitLoss("2026-08-01", "2026-08-31");
  assert.equal(r.incomeTotal, 1250.5);
  assert.equal(r.expenseTotal, 500.25);
  assert.equal(r.netProfit, 750.25);
  assert.equal(Object.values(r.byIncomeCat).reduce((a, b) => a + b, 0), r.incomeTotal);
  assert.equal(Object.values(r.byExpenseCat).reduce((a, b) => a + b, 0), r.expenseTotal);
});

test("sum() does not leak floating-point drift", () => {
  assert.equal(fin.sum([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);
});

test("cash-flow is cash-basis: delivered-but-unverified bKash is NOT cash in, but P&L still counts it", async () => {
  await mkOrder({ total: 200, payment: "bkash", paymentStatus: "pending", deliveredAt: "2026-09-10T06:00:00.000Z" });
  await mkOrder({ total: 300, payment: "bkash", paymentStatus: "paid", deliveredAt: "2026-09-11T06:00:00.000Z" });
  await mkOrder({ total: 50, payment: "cod", paymentStatus: undefined, deliveredAt: "2026-09-12T06:00:00.000Z" }); // legacy COD
  const cf = await fin.cashflow("2026-09-10", "2026-09-12");
  assert.equal(cf.totalIn, 350);
  assert.equal((await fin.profitLoss("2026-09-10", "2026-09-12")).incomeTotal, 550);
});

test("cash-flow running balance is cumulative and ends at in - out", async () => {
  await mkOrder({ total: 1000, deliveredAt: "2026-10-01T06:00:00.000Z" });
  await fin.createExpense({ category: "Rent", amount: 300, date: "2026-10-02", paymentMethod: "cash", note: "", createdBy: "t" } as any);
  const cf = await fin.cashflow("2026-10-01", "2026-10-02");
  assert.deepEqual(cf.rows.map((r) => r.balance), [1000, 700]);
  assert.equal(cf.closingBalance, cf.totalIn - cf.totalOut);
});

test("manual income cannot be linked to a delivered order (would double-count sales)", async () => {
  const o = await mkOrder({ total: 400, deliveredAt: "2026-02-02T06:00:00.000Z" });
  await assert.rejects(fin.createIncome({ category: "Sales", amount: 400, date: "2026-02-02", paymentMethod: "cash", note: "", orderId: o.id, createdBy: "t" } as any), (e: any) => e.status === 409);
  await assert.rejects(fin.createIncome({ category: "Sales", amount: 1, date: "2026-02-02", paymentMethod: "cash", note: "", orderId: "ghost", createdBy: "t" } as any), (e: any) => e.status === 404);
  const pending = await mkOrder({ status: "pending", total: 10 });
  await fin.createIncome({ category: "Advance", amount: 10, date: "2026-02-02", paymentMethod: "cash", note: "", orderId: pending.id, createdBy: "t" } as any); // allowed
});

test("amount and date validation", async () => {
  await assert.rejects(fin.createExpense({ category: "x", amount: 0, date: "2026-01-01" } as any), (e: any) => e.status === 400);
  await assert.rejects(fin.createExpense({ category: "x", amount: 5, date: "2026-02-31" } as any), (e: any) => e.status === 400); // not a real date
});

test("parseRange: defaults, bad dates, reversed range", () => {
  const d = fin.parseRange(undefined, "2026-05-20");
  assert.deepEqual(d, { from: "2026-05-01", to: "2026-05-20" });
  assert.throws(() => fin.parseRange("2026-13-01", "2026-05-20"), (e: any) => e.status === 400);
  assert.throws(() => fin.parseRange("2026-05-21", "2026-05-20"), (e: any) => e.status === 400);
  assert.throws(() => fin.parseRange("garbage", null), (e: any) => e.status === 400);
});
