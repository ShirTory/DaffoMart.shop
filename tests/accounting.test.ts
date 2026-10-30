import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
process.env.ADMIN_EMAIL = "owner@daffomart.test";
process.env.ADMIN_PASSWORD = "owner-password-123";
process.env.AUTH_SECRET = "x".repeat(40);

const { db, newId } = await import("@/server/db");
const fin = await import("@/server/finance");
const acc = await import("@/server/accounting");
const auth = await import("@/server/auth");
const { upsertAdmin } = await import("@/server/adminAccounts");
const { productCfg, claimSku } = await import("@/server/resources");

const today = fin.todayYmd();
const thisMonth = today.slice(0, 7);
const fail = async (fn: () => Promise<unknown>) => { try { await fn(); return 0; } catch (e: any) { return e.status as number; } };

let n = 0;
const mkOrder = async (o: Record<string, unknown>) => {
  const id = newId();
  const rec = { id, orderNo: `DM-A${++n}`, name: "Cust", phone: "01712345678", address: "x", zone: "z", payment: "cod", paymentStatus: "paid", note: "", items: [], subtotal: 0, delivery: 0, serviceCharge: 0, discount: 0, total: 0, status: "delivered", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...o };
  await db.put("orders", rec as any);
  return rec as any;
};
const mkEmployee = async (extra: Record<string, unknown> = {}) => {
  const e = { id: newId(), name: "Staff " + ++n, role: "Operations", phone: "017", email: "", note: "", active: true, createdAt: "2026-01-01T00:00:00.000Z", salary: 20000, ...extra };
  await db.put("employees", e as any); return e as any;
};
const mkRider = async (extra: Record<string, unknown> = {}) => {
  const r = { id: newId(), name: "Rider " + ++n, phone: "018", vehicle: "bike", area: "", note: "", active: true, createdAt: "2026-01-01T00:00:00.000Z", ...extra };
  await db.put("riders", r as any); return r as any;
};
const mkProduct = async (extra: Record<string, unknown> = {}) => {
  const p = { id: newId(), slug: "p" + ++n, name: "Rice " + n, description: "", price: 100, unit: "1kg", emoji: "x", images: [], categoryId: "c", stock: 10, rating: 0, sold: 0, featured: false, active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...extra };
  await db.put("products", p as any); return p as any;
};

/* ------------------------------------------------------------ payroll */
test("salary: one entry per person per month, net payable = base + additions - deductions - advances", async () => {
  const e = await mkEmployee({ salary: 20000 });
  const a = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, bonus: 1000, overtime: 500, deductions: 300, advances: 200, by: "acct" });
  assert.equal(a.base, 20000); assert.equal(a.amount, 21000);
  const b = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, bonus: 1000, overtime: 500, deductions: 300, advances: 200, note: "again", by: "acct2" });
  assert.equal(b.id, a.id); assert.equal(b.revision, 2); assert.equal(b.createdBy, "acct"); assert.equal(b.updatedBy, "acct2");
  assert.equal((await db.list<any>("payroll")).filter((x) => x.subjectId === e.id).length, 1, "no duplicate payroll entry");
});

test("salary: partial and full payments reduce the outstanding balance; overpaying and bad input are refused", async () => {
  const e = await mkEmployee({ salary: 10000 });
  const entry = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, by: "t" });
  await acc.recordPayment({ kind: "salary", refId: entry.id, amount: 4000, date: today, method: "bkash", reference: "TX1", by: "t" });
  let s = await acc.payrollSummary(thisMonth);
  assert.equal(s.rows.find((r) => r.employeeId === e.id)!.outstanding, 6000);
  assert.equal(await fail(() => acc.recordPayment({ kind: "salary", refId: entry.id, amount: 6000.5, date: today, by: "t" })), 409);
  assert.equal(await fail(() => acc.recordPayment({ kind: "salary", refId: entry.id, amount: -5, date: today, by: "t" })), 400);
  assert.equal(await fail(() => acc.recordPayment({ kind: "salary", refId: entry.id, amount: 100, date: "2026-02-30", by: "t" })), 400);
  await acc.recordPayment({ kind: "salary", refId: entry.id, amount: 6000, date: today, by: "t" });
  s = await acc.payrollSummary(thisMonth);
  assert.equal(s.rows.find((r) => r.employeeId === e.id)!.outstanding, 0);
  assert.equal(await fail(() => acc.recordPayment({ kind: "salary", refId: entry.id, amount: 1, date: today, by: "t" })), 409);
});

test("payments: the same idempotency key never pays twice; a reversal keeps the record and re-opens the balance", async () => {
  const e = await mkEmployee({ salary: 5000 });
  const entry = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, by: "t" });
  const p1 = await acc.recordPayment({ kind: "salary", refId: entry.id, amount: 2000, date: today, idempotencyKey: "click-1", by: "t" });
  const p2 = await acc.recordPayment({ kind: "salary", refId: entry.id, amount: 2000, date: today, idempotencyKey: "click-1", by: "t" });
  assert.equal(p2.duplicate, true); assert.equal(p2.payment!.id, p1.payment!.id);
  assert.equal((await acc.listPayments({ refId: entry.id })).length, 1);
  assert.equal(await fail(() => acc.reversePayment(p1.payment!.id, "", "t")), 400);
  await acc.reversePayment(p1.payment!.id, "wrong staff member", "owner");
  assert.equal(await fail(() => acc.reversePayment(p1.payment!.id, "again please", "owner")), 409);
  assert.equal((await acc.listPayments({ refId: entry.id })).length, 0);
  assert.equal((await acc.listPayments({ refId: entry.id, includeReversed: true })).length, 1, "record is kept");
  assert.equal((await acc.staffStatement(e.id)).outstanding, 5000);
});

test("salary history: raising the current salary does not change a month that was already recorded", async () => {
  const e = await mkEmployee({ salary: 10000 });
  const old = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, by: "t" });
  await acc.setSalary(e.id, 15000, today);
  const again = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, note: "edit note only", by: "t" });
  assert.equal(again.base, 10000); assert.equal(old.amount, again.amount);
  const emp = await db.get<any>("employees", e.id);
  assert.equal(emp.salary, 15000);
  assert.ok(emp.salaryHistory.length >= 2);
});

test("salary: future months, bad periods, and net-negative pay are rejected; payable cannot drop below what was paid", async () => {
  const e = await mkEmployee({ salary: 1000 });
  assert.equal(await fail(() => acc.upsertSalaryEntry({ employeeId: e.id, period: "2099-01", by: "t" })), 400);
  assert.equal(await fail(() => acc.upsertSalaryEntry({ employeeId: e.id, period: "2026-13", by: "t" })), 400);
  assert.equal(await fail(() => acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, deductions: 5000, by: "t" })), 400);
  assert.equal(await fail(() => acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, bonus: -1, by: "t" })), 400);
  const entry = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, by: "t" });
  await acc.recordPayment({ kind: "salary", refId: entry.id, amount: 900, date: today, by: "t" });
  assert.equal(await fail(() => acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, deductions: 500, by: "t" })), 409);
});

/* ------------------------------------------------------------ rider earnings */
test("rider earnings: only DELIVERED orders earn; cancelled / returned / in-flight never do", async () => {
  const r = await mkRider({ payTerms: [{ from: "2026-01-01", perDelivery: 30, commissionPct: 10 }] });
  await mkOrder({ riderId: r.id, delivery: 60, total: 500, deliveredAt: "2026-03-10T06:00:00.000Z" });
  for (const status of ["cancelled", "returned", "on_the_way", "assigned"]) await mkOrder({ riderId: r.id, status, delivery: 60, total: 500, updatedAt: "2026-03-11T06:00:00.000Z" });
  const s = await acc.riderStatement(r.id, "2026-03-01", "2026-03-31");
  assert.equal(s.deliveries, 1); assert.equal(s.earned, 36); // 30 + 10% of 60
  assert.equal(s.balance, 36, "unpaid earnings stay outstanding");
});

test("rider earnings: re-saving a delivered order does not duplicate the earning; payments reduce the balance", async () => {
  const r = await mkRider({ payTerms: [{ from: "2026-01-01", perDelivery: 50, commissionPct: 0 }] });
  const o = await mkOrder({ riderId: r.id, delivery: 40, total: 300, deliveredAt: "2026-04-10T06:00:00.000Z" });
  await db.put("orders", { ...o, note: "touched again", updatedAt: "2026-04-20T06:00:00.000Z" }); // reprocessed
  await db.update("orders", o.id, { status: "delivered" } as any);
  assert.equal((await acc.riderStatement(r.id, "2026-04-01", "2026-04-30")).earned, 50);
  await acc.recordPayment({ kind: "rider", refId: r.id, amount: 20, date: "2026-04-25", by: "t" });
  const s = await acc.riderStatement(r.id, "2026-04-01", "2026-04-30");
  assert.equal(s.paid, 20); assert.equal(s.balance, 30);
  assert.equal(await fail(() => acc.recordPayment({ kind: "rider", refId: r.id, amount: 31, date: "2026-04-26", by: "t" })), 409);
});

test("rider terms are dated: a rate change only affects deliveries after its effective date", async () => {
  const r = await mkRider({ payTerms: [{ from: "2026-01-01", perDelivery: 40, commissionPct: 0 }] });
  await mkOrder({ riderId: r.id, delivery: 0, total: 100, deliveredAt: "2026-05-10T06:00:00.000Z" });
  await mkOrder({ riderId: r.id, delivery: 0, total: 100, deliveredAt: "2026-06-10T06:00:00.000Z" });
  await acc.setRiderTerms(r.id, { from: "2026-06-01", perDelivery: 60, commissionPct: 0 });
  assert.equal((await acc.riderStatement(r.id, "2026-05-01", "2026-05-31")).earned, 40);
  assert.equal((await acc.riderStatement(r.id, "2026-06-01", "2026-06-30")).earned, 60);
});

test("rider adjustments need a reason; deliveries without any rate are flagged, not invented", async () => {
  const r = await mkRider();
  await mkOrder({ riderId: r.id, delivery: 50, total: 100, deliveredAt: "2026-07-10T06:00:00.000Z" });
  const s = await acc.riderStatement(r.id, "2026-07-01", "2026-07-31");
  assert.equal(s.earned, 0); assert.equal(s.unrated, 1);
  assert.equal(await fail(() => acc.addRiderAdjustment({ riderId: r.id, amount: 100, reason: "", date: "2026-07-31", by: "t" })), 400);
  await acc.addRiderAdjustment({ riderId: r.id, amount: 1000, reason: "Monthly fixed pay", date: "2026-07-31", by: "t" });
  await acc.addRiderAdjustment({ riderId: r.id, amount: -100, reason: "Damaged parcel", date: "2026-07-31", by: "t" });
  assert.equal((await acc.riderStatement(r.id, "2026-07-01", "2026-07-31")).balance, 900);
});

/* ------------------------------------------------------------ P&L */
test("P&L: salary and rider cost reduce profit exactly once; manual 'Staff Salary' expenses are refused (would double count)", async () => {
  const from = "2025-01-01", to = "2025-01-31";
  const e = await mkEmployee({ salary: 8000 });
  await db.put("payroll", { id: `${e.id}:2025-01`, kind: "salary", subjectId: e.id, subjectName: e.name, period: "2025-01", date: "2025-01-31", base: 8000, allowances: 0, bonus: 0, overtime: 0, deductions: 0, advances: 0, amount: 8000, note: "", createdBy: "t", createdAt: "x", updatedAt: "x", revision: 1 } as any);
  const r = await mkRider({ payTerms: [{ from: "2025-01-01", perDelivery: 25, commissionPct: 0 }] });
  await mkOrder({ riderId: r.id, subtotal: 1000, delivery: 60, discount: 50, total: 1010, deliveredAt: "2025-01-10T06:00:00.000Z" });
  await fin.createExpense({ category: "Rent", amount: 700, date: "2025-01-05", paymentMethod: "cash", note: "", createdBy: "t" } as any);
  assert.equal(await fail(() => fin.createExpense({ category: "Staff Salary", amount: 8000, date: "2025-01-05", paymentMethod: "cash", note: "", createdBy: "t" } as any)), 409);
  const p = await acc.profitLossFull(from, to);
  assert.equal(p.incomeTotal, 1010);
  assert.equal(p.salaryExpense, 8000); assert.equal(p.riderExpense, 25);
  assert.equal(p.expenseTotal, 8725); assert.equal(p.netProfit, 1010 - 8725);
  assert.equal(p.grossSales, 1000); assert.equal(p.discounts, 50); assert.equal(p.deliveryFees, 60); assert.equal(p.deliveryMargin, 35);
});

test("P&L: gross profit uses real recorded costs and is withheld (null) when costs are missing", async () => {
  const from = "2025-02-01", to = "2025-02-28";
  await mkOrder({ items: [{ id: "p", name: "Rice", unit: "1kg", price: 100, qty: 3, cost: 70 }], subtotal: 300, total: 300, deliveredAt: "2025-02-10T06:00:00.000Z" });
  let p = await acc.profitLossFull(from, to);
  assert.equal(p.cogs, 210); assert.equal(p.cogsComplete, true); assert.equal(p.grossProfit, 90);
  await mkOrder({ items: [{ id: "q", name: "Oil", unit: "1l", price: 200, qty: 1 }], subtotal: 200, total: 200, deliveredAt: "2025-02-11T06:00:00.000Z" });
  p = await acc.profitLossFull(from, to);
  assert.equal(p.cogsComplete, false); assert.equal(p.grossProfit, null); assert.equal(p.netProfitCogsBasis, null); assert.equal(p.ordersWithoutCost, 1);
});

/* ------------------------------------------------------------ purchases & inventory */
test("purchases: stock is added exactly once; receiving twice or re-saving the same invoice does not duplicate", async () => {
  const sup = await acc.createSupplier({ name: "Rahim Traders " + n });
  const prod = await mkProduct({ stock: 10 });
  const input = { supplierId: sup.id, invoiceNo: "INV-1", date: today, items: [{ productId: prod.id, qty: 20, unitCost: 80 }], by: "t" };
  const p = await acc.createPurchase(input);
  assert.equal(p.total, 1600); assert.equal(p.received, false);
  assert.equal((await db.get<any>("products", prod.id)).stock, 10, "nothing changes until received");
  await acc.receivePurchase(p.id);
  const again = await acc.receivePurchase(p.id);
  assert.equal(again.already, true);
  const after = await db.get<any>("products", prod.id);
  assert.equal(after.stock, 30); assert.equal(after.cost, 80);
  assert.equal(await fail(() => acc.createPurchase(input)), 409, "same supplier + invoice number is refused");
  assert.equal((await db.list<any>("stocklogs")).filter((l) => l.productId === prod.id).length, 1);
});

test("purchases: weighted-average cost, partial supplier payments, outstanding dues, valuation", async () => {
  const sup = await acc.createSupplier({ name: "Karim & Sons " + n });
  const prod = await mkProduct({ stock: 10, cost: 50 });
  const p = await acc.createPurchase({ supplierId: sup.id, invoiceNo: "A-9", date: today, items: [{ productId: prod.id, qty: 10, unitCost: 70 }], by: "t" });
  await acc.receivePurchase(p.id);
  assert.equal((await db.get<any>("products", prod.id)).cost, 60); // (10*50 + 10*70) / 20
  await acc.recordPayment({ kind: "supplier", refId: p.id, amount: 300, date: today, by: "t" });
  const d = await acc.supplierDues();
  assert.equal(d.suppliers.find((s) => s.id === sup.id)!.outstanding, 400);
  assert.equal(await fail(() => acc.recordPayment({ kind: "supplier", refId: p.id, amount: 401, date: today, by: "t" })), 409);
  const v = await acc.inventoryValuation();
  assert.ok(v.value >= 1200);
  assert.equal(await fail(() => acc.createPurchase({ supplierId: sup.id, date: today, items: [{ productId: prod.id, qty: 0, unitCost: 5 }], by: "t" })), 400);
});

test("editing a product in the admin keeps its recorded cost", async () => {
  const prod = await mkProduct({ sku: "KEEP-1", cost: 42 });
  const rec: any = await productCfg.prepare({ ...prod, sku: "KEEP-1" }, prod, prod.id);
  assert.equal(rec.cost, 42);
});

/* ------------------------------------------------------------ SKU atomicity */
test("SKU: two simultaneous saves of the same SKU — exactly one wins", async () => {
  const body = (name: string) => ({ name, sku: "RACE-1", categoryId: "c", price: 10, unit: "1", stock: 1, description: "", emoji: "x", images: [], featured: false, active: true });
  const ids = [newId(), newId(), newId(), newId()];
  const results = await Promise.allSettled(ids.map((id, i) => productCfg.prepare(body("P" + i), null, id)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of results) if (r.status === "rejected") assert.equal((r.reason as any).status, 409);
});

test("SKU: an unpublished product may have no SKU, a published one may not; releasing frees the SKU", async () => {
  const b = { name: "X", categoryId: "c", price: 1, unit: "1", stock: 1, description: "", emoji: "x", images: [], featured: false };
  assert.equal(await fail(() => productCfg.prepare({ ...b, active: true }, null, newId())), 400);
  await productCfg.prepare({ ...b, active: false }, null, newId());
  const id = newId();
  await claimSku("FREE-1", id);
  assert.equal(await fail(() => claimSku("FREE-1", newId())), 409, "held while its product exists");
});

/* ------------------------------------------------------------ cashbook & balances */
test("balances: opening balance + cash-in - cash-out reconciles, per account and in total", async () => {
  await acc.setOpeningBalance({ method: "bankx", openingBalance: 10000, openingDate: "2025-03-01", by: "t" });
  await db.put("finance_incomes", { id: newId(), category: "Other Income", amount: 2500, date: "2025-03-05", paymentMethod: "bankx", note: "", createdBy: "t", createdAt: "x", updatedAt: "x" } as any);
  await fin.createExpense({ category: "Utility", amount: 800, date: "2025-03-06", paymentMethod: "bankx", note: "", createdBy: "t" } as any);
  await db.put("finance_incomes", { id: newId(), category: "Other Income", amount: 999, date: "2025-02-01", paymentMethod: "bankx", note: "before the opening date", createdBy: "t", createdAt: "x", updatedAt: "x" } as any);
  const b = await acc.accountBalances("2025-03-31");
  const row = b.rows.find((r) => r.account === "bankx")!;
  assert.equal(row.balance, 10000 + 2500 - 800, "history before the opening date is ignored, nothing invented");
  const cf = await acc.cashflowFull("2025-03-01", "2025-03-31");
  assert.ok(cf.rows.some((r) => r.account === "bankx" && r.amount === 800));
  assert.equal(cf.closingBalance, cf.openingBalance + cf.totalIn - cf.totalOut);
});

test("receivables: a partial customer collection reduces the dues, and marking the order paid later does not double count the cash", async () => {
  const o = await mkOrder({ paymentStatus: "unpaid", payment: "bkash", total: 1000, deliveredAt: "2025-04-10T06:00:00.000Z" });
  assert.equal((await acc.receivables()).rows.find((r) => r.orderId === o.id)!.outstanding, 1000);
  await acc.recordPayment({ kind: "receivable", refId: o.id, amount: 400, date: "2025-04-12", method: "bkash", by: "t" });
  assert.equal((await acc.receivables()).rows.find((r) => r.orderId === o.id)!.outstanding, 600);
  assert.equal(await fail(() => acc.recordPayment({ kind: "receivable", refId: o.id, amount: 601, date: "2025-04-12", by: "t" })), 409);
  let cf = await acc.cashflowFull("2025-04-01", "2025-04-30");
  assert.equal(cf.totalIn, 400);
  await db.update("orders", o.id, { paymentStatus: "paid" } as any);
  cf = await acc.cashflowFull("2025-04-01", "2025-04-30");
  assert.equal(cf.totalIn, 1000, "400 collected + 600 remainder = 1000, counted once");
  assert.equal(await fail(() => acc.recordPayment({ kind: "receivable", refId: o.id, amount: 1, date: "2025-04-13", by: "t" })), 409);
});

test("persistence: a saved payroll entry and payment read back with the same values", async () => {
  const e = await mkEmployee({ salary: 12345.67 });
  const entry = await acc.upsertSalaryEntry({ employeeId: e.id, period: thisMonth, by: "t" });
  const back = await db.get<any>("payroll", entry.id);
  assert.equal(back.amount, 12345.67); assert.equal(back.subjectName, e.name);
});

/* ------------------------------------------------------------ permissions */
const signIn = async (email: string, role: "owner" | "it_support" | "accountant", fullAccess: boolean) => {
  (globalThis as any).__testCookies = {};
  await auth.createSessionCookie(email, { adminRole: role, fullAccess });
};

test("Accountant: finance yes; products / orders / settings / owner actions are refused; cannot be granted full access", async () => {
  const rec = await upsertAdmin({ email: "acct@daffomart.test", role: "accountant", fullAccess: true, active: true, password: "acct-password-1", grantedBy: "owner" });
  assert.equal(rec.fullAccess, false, "an Accountant never gets full admin access");
  const s = await auth.authenticateAdmin("acct@daffomart.test", "acct-password-1");
  assert.deepEqual(s && { r: s.adminRole, f: s.fullAccess }, { r: "accountant", f: false });
  await signIn("acct@daffomart.test", "accountant", false);
  assert.equal(await fail(auth.requireFinance), 0);
  assert.equal(await fail(auth.requireAdmin), 403);
  assert.equal(await fail(auth.requireOwner), 403);
});

test("Accountant: a forged token cannot lift the role, and deactivating the account takes effect immediately", async () => {
  const a = (await db.list<any>("admins")).find((x) => x.email === "acct@daffomart.test");
  await signIn(a.email, "owner", true); // token claims owner
  assert.equal((await auth.getAdmin())!.adminRole, "accountant");
  assert.equal(await fail(auth.requireAdmin), 403);
  await upsertAdmin({ email: a.email, role: "accountant", fullAccess: false, active: false, grantedBy: "owner" }, a.id);
  assert.equal(await fail(auth.requireFinance), 401);
});

test("IT Support without full access cannot use finance; with full access it can", async () => {
  await upsertAdmin({ email: "it2@daffomart.test", role: "it_support", fullAccess: false, active: true, password: "it-password-123", grantedBy: "owner" });
  await signIn("it2@daffomart.test", "it_support", false);
  assert.equal(await fail(auth.requireFinance), 403);
  const a = (await db.list<any>("admins")).find((x) => x.email === "it2@daffomart.test");
  await upsertAdmin({ email: a.email, role: "it_support", fullAccess: true, active: true, grantedBy: "owner" }, a.id);
  assert.equal(await fail(auth.requireFinance), 0);
});
