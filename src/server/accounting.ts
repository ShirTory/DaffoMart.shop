import { createHash } from "crypto";
import { db, newId } from "./db";
import { ApiError } from "./http";
import { isRealDate, isRevenueOrder, isCashReceived, listExpenses, listManualIncomes, money, profitLoss, revenueDate, sum, todayYmd, ymd } from "./finance";
import type { Employee, FinanceAccount, FinancePayment, Order, PaymentKind, PayrollEntry, Product, Purchase, PurchaseItem, RateTerm, Rider, SalaryTerm, StockLog, Supplier } from "@/lib/types";

/* ------------------------------------------------------------------ helpers */
const FINITE_MAX = 1e9;
const num = (v: unknown, label: string, opts: { min?: number; allowZero?: boolean } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > FINITE_MAX) throw new ApiError(400, `${label} must be a valid number`);
  if (opts.min !== undefined && n < opts.min) throw new ApiError(400, `${label} cannot be less than ${opts.min}`);
  return money(n);
};
const nonNeg = (v: unknown, label: string) => num(v ?? 0, label, { min: 0 });
const mustDate = (d: unknown, label = "Date") => { if (typeof d !== "string" || !isRealDate(d)) throw new ApiError(400, `${label} must be a real date (YYYY-MM-DD)`); return d; };
export const isPeriod = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
const periodEnd = (p: string) => { const [y, m] = p.split("-").map(Number); return `${p}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; };
/** A payment method is one money account. COD cash is cash in hand. */
export const acct = (m?: string) => { const x = (m || "cash").trim().toLowerCase(); return x === "cod" || x === "" ? "cash" : x; };

/** Serialises work per key inside one server instance (two clicks on "Pay" cannot both pass the outstanding check). */
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  locks.set(key, run);
  try { return await run; } finally { if (locks.get(key) === run) locks.delete(key); }
}

/* ------------------------------------------------------------------ payments (shared ledger of money paid out / collected) */
const livePayments = async (kind?: PaymentKind, refId?: string) =>
  (await db.list<FinancePayment>("finance_payments")).filter((p) => !p.reversedAt && (!kind || p.kind === kind) && (!refId || p.refId === refId));
const paidSum = async (kind: PaymentKind, refId: string) => sum(await livePayments(kind, refId));

export async function listPayments(f: { kind?: string; refId?: string; from?: string; to?: string; includeReversed?: boolean } = {}) {
  return (await db.list<FinancePayment>("finance_payments"))
    .filter((p) => (f.includeReversed || !p.reversedAt) && (!f.kind || p.kind === f.kind) && (!f.refId || p.refId === f.refId) && (!f.from || p.date >= f.from) && (!f.to || p.date <= f.to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

async function outstandingFor(kind: PaymentKind, refId: string): Promise<number> {
  if (kind === "salary") {
    const e = await db.get<PayrollEntry>("payroll", refId);
    if (!e || e.kind !== "salary") throw new ApiError(404, "Salary entry not found. Create the payroll entry for that month first.");
    return money(e.amount - (await paidSum("salary", refId)));
  }
  if (kind === "supplier") {
    const p = await db.get<Purchase>("purchases", refId);
    if (!p) throw new ApiError(404, "Purchase not found");
    return money(p.total - (await paidSum("supplier", refId)));
  }
  if (kind === "rider") return (await riderStatement(refId)).balance;
  const o = await db.get<Order>("orders", refId);
  if (!o) throw new ApiError(404, "Order not found");
  if (!isRevenueOrder(o)) throw new ApiError(409, "Only delivered orders can have a customer collection recorded");
  if (isCashReceived(o)) throw new ApiError(409, `Order ${o.orderNo} is already marked as paid`);
  return money(o.total - (await paidSum("receivable", refId)));
}

export async function recordPayment(input: { kind: PaymentKind; refId: string; amount: unknown; date: string; method?: string; reference?: string; note?: string; idempotencyKey?: string; by: string }) {
  if (!["salary", "rider", "supplier", "receivable"].includes(input.kind)) throw new ApiError(400, "Unknown payment kind");
  const amount = num(input.amount, "Amount");
  if (!(amount > 0)) throw new ApiError(400, "Amount must be greater than 0");
  const date = mustDate(input.date, "Payment date");
  return withLock(`pay:${input.kind}:${input.refId}`, async () => {
    const id = input.idempotencyKey ? createHash("sha1").update(`${input.kind}|${input.refId}|${input.idempotencyKey}`).digest("hex").slice(0, 16) : newId();
    if (input.idempotencyKey) { const dup = await db.get<FinancePayment>("finance_payments", id); if (dup) return { payment: dup, duplicate: true }; }
    const outstanding = await outstandingFor(input.kind, input.refId);
    if (amount > outstanding + 0.005) throw new ApiError(409, `Amount ৳${amount} is more than the outstanding balance ৳${Math.max(outstanding, 0)}`);
    const rec: FinancePayment = { id, kind: input.kind, refId: input.refId, amount, date, method: acct(input.method), reference: (input.reference || "").slice(0, 80), note: (input.note || "").slice(0, 300), createdBy: input.by, createdAt: new Date().toISOString() };
    if (input.kind === "rider") rec.subjectId = input.refId;
    if (!(await db.create("finance_payments", rec))) return { payment: await db.get<FinancePayment>("finance_payments", id), duplicate: true };
    return { payment: rec, duplicate: false };
  });
}

/** Posted payments are never deleted: a reversal keeps the record, who reversed it and why. */
export async function reversePayment(id: string, reason: string, by: string) {
  if ((reason || "").trim().length < 3) throw new ApiError(400, "A reason is required to reverse a payment");
  const p = await db.get<FinancePayment>("finance_payments", id);
  if (!p) throw new ApiError(404, "Payment not found");
  if (p.reversedAt) throw new ApiError(409, "This payment has already been reversed");
  const next = { ...p, reversedAt: new Date().toISOString(), reversedBy: by, reverseReason: reason.trim().slice(0, 200) };
  await db.put("finance_payments", next);
  return next;
}

/* ------------------------------------------------------------------ staff payroll */
export function salaryFor(emp: Employee, period: string) {
  const hist = [...(emp.salaryHistory ?? [])].sort((a, b) => a.from.localeCompare(b.from));
  if (!hist.length) return emp.salary ?? 0; // legacy employees: the single salary field
  return hist.filter((h) => h.from <= `${period}-01`).pop()?.amount ?? 0;
}

/** Append (or replace the same-day) salary term; earlier periods keep the amount that applied then. */
export async function setSalary(employeeId: string, amount: unknown, from: string) {
  const emp = await db.get<Employee>("employees", employeeId);
  if (!emp) throw new ApiError(404, "Staff member not found");
  const a = nonNeg(amount, "Salary"); mustDate(from, "Effective date");
  const hist: SalaryTerm[] = (emp.salaryHistory ?? (emp.salary !== undefined ? [{ from: (emp.joinedAt && isRealDate(emp.joinedAt) ? emp.joinedAt : "2000-01-01"), amount: emp.salary }] : [])).filter((h) => h.from !== from);
  hist.push({ from, amount: a });
  hist.sort((x, y) => x.from.localeCompare(y.from));
  await db.update<Employee>("employees", employeeId, { salaryHistory: hist, salary: hist.filter((h) => h.from <= todayYmd()).pop()?.amount ?? a });
  return hist;
}

export async function upsertSalaryEntry(i: { employeeId: string; period: string; base?: unknown; allowances?: unknown; bonus?: unknown; overtime?: unknown; deductions?: unknown; advances?: unknown; date?: string; note?: string; by: string }) {
  if (!isPeriod(i.period)) throw new ApiError(400, "Salary period must be YYYY-MM");
  if (i.period > todayYmd().slice(0, 7)) throw new ApiError(400, "A future month cannot be put on payroll yet");
  const emp = await db.get<Employee>("employees", i.employeeId);
  if (!emp) throw new ApiError(404, "Staff member not found");
  const id = `${i.employeeId}:${i.period}`; // deterministic: the same person + month can never have two entries
  return withLock(`payroll:${id}`, async () => {
    const prev = await db.get<PayrollEntry>("payroll", id);
    const base = i.base !== undefined && i.base !== "" ? nonNeg(i.base, "Base salary") : prev ? prev.base : nonNeg(salaryFor(emp, i.period), "Base salary");
    const allowances = nonNeg(i.allowances, "Allowances"), bonus = nonNeg(i.bonus, "Bonus"), overtime = nonNeg(i.overtime, "Overtime"), deductions = nonNeg(i.deductions, "Deductions"), advances = nonNeg(i.advances, "Advances");
    const amount = money(base + allowances + bonus + overtime - deductions - advances);
    if (amount < 0) throw new ApiError(400, "Deductions and advances are more than the salary: net payable cannot be negative");
    const paid = prev ? await paidSum("salary", id) : 0;
    if (amount + 0.005 < paid) throw new ApiError(409, `Net payable ৳${amount} is below the ৳${paid} already paid. Reverse a payment first.`);
    const date = i.date ? mustDate(i.date) : (periodEnd(i.period) < todayYmd() ? periodEnd(i.period) : todayYmd());
    const now = new Date().toISOString();
    const rec: PayrollEntry = {
      id, kind: "salary", subjectId: i.employeeId, subjectName: emp.name, period: i.period, date, base, allowances, bonus, overtime, deductions, advances, amount,
      note: (i.note || "").slice(0, 300), createdBy: prev?.createdBy ?? i.by, createdAt: prev?.createdAt ?? now, updatedAt: now, revision: (prev?.revision ?? 0) + 1,
      ...(prev ? { updatedBy: i.by } : {}),
    };
    await db.put("payroll", rec);
    return rec;
  });
}

export async function payrollSummary(period: string) {
  if (!isPeriod(period)) throw new ApiError(400, "Period must be YYYY-MM");
  const [emps, entries, pays] = await Promise.all([db.list<Employee>("employees"), db.list<PayrollEntry>("payroll"), livePayments("salary")]);
  const rows = emps.filter((e) => e.active && (!e.status || e.status === "approved")).map((e) => {
    const entry = entries.find((x) => x.id === `${e.id}:${period}`);
    const paid = entry ? sum(pays.filter((p) => p.refId === entry.id)) : 0;
    return { employeeId: e.id, name: e.name, role: e.role, agreedSalary: salaryFor(e, period), entry: entry ?? null, payable: entry?.amount ?? 0, paid, outstanding: entry ? money(entry.amount - paid) : 0 };
  });
  return { period, rows, totalPayable: sum(rows.map((r) => ({ amount: r.payable }))), totalPaid: sum(rows.map((r) => ({ amount: r.paid }))), totalOutstanding: sum(rows.map((r) => ({ amount: r.outstanding }))) };
}

export async function staffStatement(employeeId: string, from?: string, to?: string) {
  const emp = await db.get<Employee>("employees", employeeId);
  if (!emp) throw new ApiError(404, "Staff member not found");
  const entries = (await db.list<PayrollEntry>("payroll")).filter((e) => e.kind === "salary" && e.subjectId === employeeId && (!from || e.period >= from.slice(0, 7)) && (!to || e.period <= to.slice(0, 7))).sort((a, b) => a.period.localeCompare(b.period));
  const pays = (await listPayments({ kind: "salary" })).filter((p) => entries.some((e) => e.id === p.refId));
  const payable = sum(entries.map((e) => ({ amount: e.amount }))), paid = sum(pays);
  return { employee: { id: emp.id, name: emp.name, role: emp.role }, entries, payments: pays, payable, paid, outstanding: money(payable - paid) };
}

/* ------------------------------------------------------------------ riders */
export const riderTermFor = (r: Rider, date: string): RateTerm | undefined => [...(r.payTerms ?? [])].sort((a, b) => a.from.localeCompare(b.from)).filter((t) => t.from <= date).pop();

export async function setRiderTerms(riderId: string, t: { from: string; perDelivery: unknown; commissionPct: unknown }) {
  const r = await db.get<Rider>("riders", riderId);
  if (!r) throw new ApiError(404, "Rider not found");
  mustDate(t.from, "Effective date");
  const perDelivery = nonNeg(t.perDelivery, "Per-delivery amount"), commissionPct = nonNeg(t.commissionPct, "Commission %");
  if (commissionPct > 100) throw new ApiError(400, "Commission % cannot be above 100");
  const terms = [...(r.payTerms ?? [])].filter((x) => x.from !== t.from);
  terms.push({ from: t.from, perDelivery, commissionPct });
  terms.sort((a, b) => a.from.localeCompare(b.from));
  await db.update<Rider>("riders", riderId, { payTerms: terms });
  return terms;
}

/**
 * Earnings are DERIVED from delivered orders, one order = one earning, so reprocessing a delivery cannot duplicate it
 * and cancelled / returned / in-flight orders never earn. The rate is the one in force on the delivery date.
 */
export async function riderStatement(riderId: string, from?: string, to?: string) {
  const r = await db.get<Rider>("riders", riderId);
  if (!r) throw new ApiError(404, "Rider not found");
  const [orders, adjAll, payAll] = await Promise.all([db.list<Order>("orders"), db.list<PayrollEntry>("payroll"), livePayments("rider", riderId)]);
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const upTo = (d: string) => !to || d <= to;
  const all = orders.filter((o) => o.riderId === riderId && isRevenueOrder(o)).map((o) => {
    const date = revenueDate(o), term = riderTermFor(r, date);
    return { orderId: o.id, orderNo: o.orderNo, date, deliveryCharge: o.delivery || 0, earned: term ? money(term.perDelivery + (term.commissionPct / 100) * (o.delivery || 0)) : 0, rated: Boolean(term) };
  }).sort((a, b) => b.date.localeCompare(a.date));
  const adjustments = adjAll.filter((a) => a.kind === "rider_adjustment" && a.subjectId === riderId);
  const rows = all.filter((x) => inRange(x.date));
  const adjRows = adjustments.filter((a) => inRange(a.date));
  const payRows = payAll.filter((p) => inRange(p.date));
  const earned = sum(rows.map((x) => ({ amount: x.earned }))), adj = sum(adjRows), paid = sum(payRows);
  const balance = money(sum(all.filter((x) => upTo(x.date)).map((x) => ({ amount: x.earned }))) + sum(adjustments.filter((a) => upTo(a.date))) - sum(payAll.filter((p) => upTo(p.date))));
  return {
    rider: { id: r.id, name: r.name, phone: r.phone }, from: from ?? null, to: to ?? null, terms: r.payTerms ?? [],
    deliveries: rows.length, earned, adjustments: adj, paid, balance, unrated: all.filter((x) => inRange(x.date) && !x.rated).length,
    rows, adjustmentRows: adjRows, paymentRows: payRows,
  };
}

export async function addRiderAdjustment(i: { riderId: string; amount: unknown; reason: string; date: string; note?: string; by: string }) {
  const r = await db.get<Rider>("riders", i.riderId);
  if (!r) throw new ApiError(404, "Rider not found");
  const amount = num(i.amount, "Amount");
  if (amount === 0) throw new ApiError(400, "Adjustment cannot be 0");
  if ((i.reason || "").trim().length < 3) throw new ApiError(400, "A reason is required for every rider adjustment");
  const date = mustDate(i.date);
  const now = new Date().toISOString();
  const rec: PayrollEntry = { id: newId(), kind: "rider_adjustment", subjectId: i.riderId, subjectName: r.name, period: date.slice(0, 7), date, base: 0, allowances: 0, bonus: 0, overtime: 0, deductions: 0, advances: 0, amount, reason: i.reason.trim().slice(0, 200), note: (i.note || "").slice(0, 300), createdBy: i.by, createdAt: now, updatedAt: now, revision: 1 };
  await db.put("payroll", rec);
  return rec;
}

export async function allRiderEarnings(from: string, to: string) {
  const riders = (await db.list<Rider>("riders")).filter((r) => !r.status || r.status === "approved");
  const rows = await Promise.all(riders.map((r) => riderStatement(r.id, from, to)));
  return { from, to, rows, earned: sum(rows.map((x) => ({ amount: x.earned }))), adjustments: sum(rows.map((x) => ({ amount: x.adjustments }))), paid: sum(rows.map((x) => ({ amount: x.paid }))), outstanding: sum(rows.map((x) => ({ amount: x.balance }))) };
}

/* ------------------------------------------------------------------ suppliers & purchases */
export async function createSupplier(d: { name: string; phone?: string; address?: string; note?: string }) {
  const name = (d.name || "").trim();
  if (name.length < 2) throw new ApiError(400, "Supplier name is required");
  const all = await db.list<Supplier>("suppliers");
  if (all.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new ApiError(409, "A supplier with this name already exists");
  const now = new Date().toISOString();
  const rec: Supplier = { id: newId(), name: name.slice(0, 120), phone: (d.phone || "").slice(0, 30), address: (d.address || "").slice(0, 200), note: (d.note || "").slice(0, 300), active: true, createdAt: now, updatedAt: now };
  await db.put("suppliers", rec);
  return rec;
}

export async function createPurchase(i: { supplierId: string; invoiceNo?: string; date: string; items: { productId?: string; name?: string; qty: unknown; unitCost: unknown }[]; note?: string; receive?: boolean; by: string }) {
  const sup = await db.get<Supplier>("suppliers", i.supplierId);
  if (!sup) throw new ApiError(404, "Supplier not found");
  const date = mustDate(i.date, "Purchase date");
  if (!Array.isArray(i.items) || !i.items.length || i.items.length > 100) throw new ApiError(400, "Add between 1 and 100 purchase lines");
  const items: PurchaseItem[] = [];
  for (const [n, it] of i.items.entries()) {
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1e6) throw new ApiError(400, `Line ${n + 1}: quantity must be a whole number of at least 1`);
    const unitCost = nonNeg(it.unitCost, `Line ${n + 1}: unit cost`);
    let name = (it.name || "").trim();
    if (it.productId) { const p = await db.get<Product>("products", it.productId); if (!p) throw new ApiError(404, `Line ${n + 1}: product not found`); name = name || p.name; }
    if (!name) throw new ApiError(400, `Line ${n + 1}: product or item name is required`);
    items.push({ productId: it.productId || undefined, name: name.slice(0, 120), qty, unitCost });
  }
  const invoiceNo = (i.invoiceNo || "").trim().slice(0, 60);
  return withLock(`purchase:${i.supplierId}`, async () => {
    if (invoiceNo && (await db.list<Purchase>("purchases")).some((p) => p.supplierId === i.supplierId && p.invoiceNo.toLowerCase() === invoiceNo.toLowerCase()))
      throw new ApiError(409, `Invoice ${invoiceNo} is already recorded for ${sup.name}`); // stops the same bill being entered twice
    const now = new Date().toISOString();
    const rec: Purchase = { id: newId(), supplierId: sup.id, supplierName: sup.name, invoiceNo, date, items, total: money(items.reduce((n, x) => n + x.qty * x.unitCost, 0)), note: (i.note || "").slice(0, 300), received: false, createdBy: i.by, createdAt: now, updatedAt: now };
    await db.put("purchases", rec);
    return rec;
  });
}

/** Adds the purchased quantities to stock exactly once (marker on the purchase + one stock-log marker per line). */
export async function receivePurchase(id: string) {
  return withLock(`receive:${id}`, async () => {
    const p = await db.get<Purchase>("purchases", id);
    if (!p) throw new ApiError(404, "Purchase not found");
    if (p.received) return { purchase: p, already: true };
    for (const [n, it] of p.items.entries()) {
      if (!it.productId) continue;
      const markerId = `purchase-${p.id}-${n}`;
      if (await db.get<StockLog>("stocklogs", markerId)) continue; // this line was already applied (retry after a crash)
      const prod = await db.get<Product>("products", it.productId);
      if (!prod) throw new ApiError(409, `Product for "${it.name}" no longer exists`);
      const before = prod.stock, after = before + it.qty;
      const cost = prod.cost !== undefined && before > 0 ? money((before * prod.cost + it.qty * it.unitCost) / after) : it.unitCost;
      await db.update<Product>("products", prod.id, { stock: after, cost, updatedAt: new Date().toISOString() });
      await db.put("stocklogs", { id: markerId, productId: prod.id, productName: prod.name, before, after, change: it.qty, reason: `Purchase ${p.invoiceNo || p.id}`, createdAt: new Date().toISOString() } as StockLog);
    }
    const next: Purchase = { ...p, received: true, receivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.put("purchases", next);
    return { purchase: next, already: false };
  });
}

export async function supplierDues() {
  const [sups, purchases, pays] = await Promise.all([db.list<Supplier>("suppliers"), db.list<Purchase>("purchases"), livePayments("supplier")]);
  const purchaseRows = purchases.map((p) => { const paid = sum(pays.filter((x) => x.refId === p.id)); return { ...p, paid, outstanding: money(p.total - paid) }; }).sort((a, b) => b.date.localeCompare(a.date));
  const suppliers = sups.map((s) => { const rows = purchaseRows.filter((p) => p.supplierId === s.id); return { ...s, purchased: sum(rows.map((r) => ({ amount: r.total }))), paid: sum(rows.map((r) => ({ amount: r.paid }))), outstanding: sum(rows.map((r) => ({ amount: r.outstanding }))) }; });
  return { suppliers, purchases: purchaseRows, totalPayable: sum(suppliers.map((s) => ({ amount: s.outstanding }))) };
}

/** Value of stock on hand at average cost. Products without a recorded cost are counted separately instead of guessed. */
export async function inventoryValuation() {
  const prods = await db.list<Product>("products");
  const costed = prods.filter((p) => p.cost !== undefined && p.stock > 0);
  return { value: money(costed.reduce((n, p) => n + p.stock * (p.cost as number), 0)), productsValued: costed.length, productsWithoutCost: prods.filter((p) => p.cost === undefined && p.stock > 0).length };
}

/* ------------------------------------------------------------------ receivables */
export async function receivables() {
  const [orders, cols] = await Promise.all([db.list<Order>("orders"), livePayments("receivable")]);
  const rows = orders.filter((o) => isRevenueOrder(o) && !isCashReceived(o)).map((o) => {
    const collected = sum(cols.filter((c) => c.refId === o.id));
    return { orderId: o.id, orderNo: o.orderNo, name: o.name, phone: o.phone, date: revenueDate(o), total: o.total, collected, outstanding: money(o.total - collected) };
  }).filter((r) => r.outstanding > 0.005).sort((a, b) => a.date.localeCompare(b.date));
  return { rows, total: sum(rows.map((r) => ({ amount: r.outstanding }))) };
}

/* ------------------------------------------------------------------ money accounts, cashbook, balances */
export async function listAccounts() { return (await db.list<FinanceAccount>("finance_accounts")).sort((a, b) => a.id.localeCompare(b.id)); }

export async function setOpeningBalance(i: { method: string; label?: string; openingBalance: unknown; openingDate: string; by: string }) {
  const id = acct(i.method);
  if (!/^[a-z0-9_-]{1,30}$/.test(id)) throw new ApiError(400, "Account name: letters, numbers, - and _ only");
  const rec: FinanceAccount = { id, label: (i.label || id).slice(0, 40), openingBalance: num(i.openingBalance, "Opening balance"), openingDate: mustDate(i.openingDate, "Opening date"), updatedBy: i.by, updatedAt: new Date().toISOString() };
  await db.put("finance_accounts", rec);
  return rec;
}

export type CashEvent = { id: string; date: string; type: "in" | "out"; amount: number; label: string; account: string; ref: string };

/** Every real cash movement. Order money counts once: what was not collected separately is cash-in when the order is marked paid. */
export async function cashEvents(): Promise<CashEvent[]> {
  const [orders, incomes, expenses, pays] = await Promise.all([db.list<Order>("orders"), listManualIncomes(), listExpenses(), listPayments()]);
  const collected = new Map<string, number>();
  for (const p of pays) if (p.kind === "receivable") collected.set(p.refId, money((collected.get(p.refId) ?? 0) + p.amount));
  const ev: CashEvent[] = [];
  for (const o of orders) if (isCashReceived(o)) { const rest = money(o.total - (collected.get(o.id) ?? 0)); if (rest > 0) ev.push({ id: `order:${o.id}`, date: revenueDate(o), type: "in", amount: rest, label: `Sales #${o.orderNo}`, account: acct(o.payment), ref: o.id }); }
  for (const m of incomes) ev.push({ id: `income:${m.id}`, date: m.date, type: "in", amount: m.amount, label: m.category, account: acct(m.paymentMethod), ref: m.id });
  for (const e of expenses) ev.push({ id: `expense:${e.id}`, date: e.date, type: "out", amount: e.amount, label: e.category, account: acct(e.paymentMethod), ref: e.id });
  const PL: Record<PaymentKind, string> = { salary: "Salary payment", rider: "Rider payment", supplier: "Supplier payment", receivable: "Customer collection" };
  for (const p of pays) ev.push({ id: `payment:${p.id}`, date: p.date, type: p.kind === "receivable" ? "in" : "out", amount: p.amount, label: PL[p.kind] + (p.reference ? ` (${p.reference})` : ""), account: acct(p.method), ref: p.id });
  return ev.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Balance per account: opening balance + movements from its opening date. Accounts without an opening balance start at 0 (nothing is invented). */
export async function accountBalances(asOf = todayYmd()) {
  const [events, accounts] = await Promise.all([cashEvents(), listAccounts()]);
  const ids = new Set<string>([...accounts.map((a) => a.id), ...events.map((e) => e.account)]);
  const rows = [...ids].sort().map((id) => {
    const a = accounts.find((x) => x.id === id);
    const ev = events.filter((e) => e.account === id && e.date <= asOf && (!a || e.date >= a.openingDate));
    const cashIn = sum(ev.filter((e) => e.type === "in")), cashOut = sum(ev.filter((e) => e.type === "out"));
    return { account: id, label: a?.label ?? id, opening: a?.openingBalance ?? 0, openingDate: a?.openingDate ?? "", cashIn, cashOut, balance: money((a?.openingBalance ?? 0) + cashIn - cashOut) };
  });
  return { asOf, rows, total: sum(rows.map((r) => ({ amount: r.balance }))) };
}

/** Cashbook for a date range with a running balance that starts from the real balance at the beginning of the range. */
export async function cashflowFull(from: string, to: string) {
  const [events, accounts] = await Promise.all([cashEvents(), listAccounts()]);
  const live = events.filter((e) => { const a = accounts.find((x) => x.id === e.account); return !a || e.date >= a.openingDate; });
  const openingTotal = money(accounts.filter((a) => a.openingDate <= to).reduce((n, a) => n + a.openingBalance, 0));
  const before = live.filter((e) => e.date < from);
  let balance = money(openingTotal + sum(before.filter((e) => e.type === "in")) - sum(before.filter((e) => e.type === "out")));
  const openingBalance = balance;
  const inRange = live.filter((e) => e.date >= from && e.date <= to);
  const rows = inRange.map((e) => { balance = money(balance + (e.type === "in" ? e.amount : -e.amount)); return { ...e, balance }; });
  const totalIn = sum(inRange.filter((e) => e.type === "in")), totalOut = sum(inRange.filter((e) => e.type === "out"));
  return { from, to, rows, openingBalance, totalIn, totalOut, periodNet: money(totalIn - totalOut), closingBalance: balance };
}

/* ------------------------------------------------------------------ profit & loss with payroll, rider cost and COGS */
export async function profitLossFull(from: string, to: string) {
  const base = await profitLoss(from, to); // sales + manual income - manual expenses (unchanged formulas)
  const [orders, payroll, riders] = await Promise.all([db.list<Order>("orders"), db.list<PayrollEntry>("payroll"), allRiderEarnings(from, to)]);
  const delivered = orders.filter((o) => isRevenueOrder(o) && revenueDate(o) >= from && revenueDate(o) <= to);
  const grossSales = sum(delivered.map((o) => ({ amount: (o.subtotal || 0) + (o.serviceCharge || 0) })));
  const discounts = sum(delivered.map((o) => ({ amount: o.discount || 0 })));
  const deliveryFees = sum(delivered.map((o) => ({ amount: o.delivery || 0 })));
  const salaryExpense = sum(payroll.filter((e) => e.kind === "salary" && e.date >= from && e.date <= to));
  const riderExpense = money(riders.earned + riders.adjustments);
  const expenseTotal = money(base.expenseTotal + salaryExpense + riderExpense);
  const byExpenseCat = { ...base.byExpenseCat };
  if (salaryExpense) byExpenseCat["Salaries (payroll)"] = salaryExpense;
  if (riderExpense) byExpenseCat["Rider earnings"] = riderExpense;

  let cogs = 0, unknownOrders = 0;
  for (const o of delivered) {
    if (!o.items.length || o.items.some((x) => x.cost === undefined)) { unknownOrders++; continue; }
    cogs += o.items.reduce((n, x) => n + x.qty * (x.cost as number), 0);
  }
  cogs = money(cogs);
  const cogsComplete = unknownOrders === 0;
  const operatingExpenses = money(expenseTotal - (base.byExpenseCat["Purchase"] || 0)); // purchases are inventory: they reach profit through COGS
  const itemSales = money(grossSales - discounts);
  return {
    ...base, expenseTotal, byExpenseCat, netProfit: money(base.incomeTotal - expenseTotal),
    netProfitBasis: "Recorded-expense basis: sales + other income - every recorded expense (including manual Purchase expenses), payroll and rider earnings.",
    grossSales, discounts, deliveryFees, itemSalesNet: itemSales,
    salaryExpense, riderExpense, deliveryMargin: money(deliveryFees - riderExpense),
    cogs, cogsComplete, ordersWithoutCost: unknownOrders, deliveredOrders: delivered.length,
    grossProfit: cogsComplete ? money(itemSales - cogs) : null,
    operatingExpenses,
    netProfitCogsBasis: cogsComplete ? money(base.incomeTotal - cogs - operatingExpenses) : null,
    cogsNote: cogsComplete ? "Cost of goods sold uses the unit cost recorded on each order line." : `${unknownOrders} of ${delivered.length} delivered orders have no recorded product cost (placed before costs were tracked), so gross profit is not reported for this period.`,
    formulas: "Net profit (COGS basis) = sales + other income - COGS - operating expenses. Operating expenses exclude manual 'Purchase' expenses (inventory) but include payroll, rider earnings and delivery cost.",
  };
}
