import { db, newId } from "./db";
import type { FinanceExpense, FinanceIncome, Order } from "@/lib/types";
import { ApiError } from "./http";

/** The business runs on Bangladesh time (UTC+6, no daylight saving). All finance day boundaries use it, like the dashboard. */
const DHAKA_OFFSET_MS = 6 * 3600_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date (YYYY-MM-DD) in Dhaka for an ISO timestamp or Date. Returns "" for invalid input. */
export function ymd(isoOrDate: string | Date) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayYmd() {
  return ymd(new Date());
}

export function isRealDate(s: string) {
  if (!YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // rejects 2026-13-01 and rolled-over dates like 2026-02-31
}

/** Validates ?from=&to= (defaults: first of the current month .. today). Throws 400 for bad or reversed ranges. */
export function parseRange(from?: string | null, to?: string | null) {
  const t = to || todayYmd();
  const f = from || t.slice(0, 7) + "-01";
  if (!isRealDate(t) || !isRealDate(f)) throw new ApiError(400, "Dates must be real calendar dates in YYYY-MM-DD format");
  if (f > t) throw new ApiError(400, "The 'from' date cannot be after the 'to' date");
  return { from: f, to: t };
}

/** Round to 2 decimals so floating-point drift never leaks into totals. */
export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Revenue-recognized orders: delivered (goods delivered / cash typically collected). */
export function isRevenueOrder(o: Order) {
  return o.status === "delivered";
}

/** Day revenue is recognised: when the order was delivered. Legacy orders without `deliveredAt` fall back to their last update. */
export const revenueDate = (o: Order) => ymd(o.deliveredAt || o.updatedAt || o.createdAt);

/** Money actually in hand: marked paid, or a legacy cash-on-delivery order that predates payment statuses. Used by cash-flow. */
export function isCashReceived(o: Order) {
  if (!isRevenueOrder(o)) return false;
  if (o.paymentStatus) return o.paymentStatus === "paid";
  return o.payment === "cod";
}

export async function listDeliveredOrders(from?: string, to?: string): Promise<Order[]> {
  const all = await db.list<Order>("orders");
  return all.filter((o) => {
    if (!isRevenueOrder(o)) return false;
    const d = revenueDate(o);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export async function listExpenses(from?: string, to?: string): Promise<FinanceExpense[]> {
  const all = await db.list<FinanceExpense>("finance_expenses");
  return all
    .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function listManualIncomes(from?: string, to?: string): Promise<FinanceIncome[]> {
  const all = await db.list<FinanceIncome>("finance_incomes");
  return all
    .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export type IncomeRow = {
  id: string;
  source: "order" | "manual";
  orderId?: string;
  orderNo?: string;
  date: string;
  amount: number;
  paymentMethod: string;
  category: string;
  note: string;
};

/** `cashBasis` keeps only orders whose money has really been received (cash-flow); the default is accrual (P&L, sales reports). */
export async function buildIncomeRows(from?: string, to?: string, opts: { cashBasis?: boolean } = {}): Promise<IncomeRow[]> {
  const [delivered, manual] = await Promise.all([listDeliveredOrders(from, to), listManualIncomes(from, to)]);
  const orders = opts.cashBasis ? delivered.filter(isCashReceived) : delivered;
  const rows: IncomeRow[] = [];
  for (const o of orders) {
    rows.push({
      id: `order:${o.id}`,
      source: "order",
      orderId: o.id,
      orderNo: o.orderNo || o.id.slice(0, 8),
      date: revenueDate(o),
      amount: o.total,
      paymentMethod: o.paymentLabel || o.payment || "cod",
      category: "Sales",
      note: `${o.name} · ${o.phone}`,
    });
  }
  for (const m of manual) {
    rows.push({
      id: m.id,
      source: "manual",
      orderId: m.orderId,
      date: m.date,
      amount: m.amount,
      paymentMethod: m.paymentMethod,
      category: m.category,
      note: m.note,
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function sum(rows: { amount: number }[]) {
  return money(rows.reduce((n, r) => n + (Number(r.amount) || 0), 0));
}

export async function financeOverview() {
  const t = todayYmd();
  const monthStart = t.slice(0, 7) + "-01";
  const [todayIncome, todayExp, monthIncome, monthExp, pending] = await Promise.all([
    buildIncomeRows(t, t),
    listExpenses(t, t),
    buildIncomeRows(monthStart, t),
    listExpenses(monthStart, t),
    pendingReceivables(),
  ]);
  const todayRev = sum(todayIncome);
  const todayEx = sum(todayExp);
  const monthRev = sum(monthIncome);
  const monthEx = sum(monthExp);
  return {
    today: { revenue: todayRev, expense: todayEx, profit: money(todayRev - todayEx) },
    month: { revenue: monthRev, expense: monthEx, profit: money(monthRev - monthEx) },
    pendingReceivables: pending.total,
    pendingCount: pending.count,
  };
}

/** Orders not yet delivered but confirmed/processing — potential future cash; or delivered unpaid non-COD */
export async function pendingReceivables() {
  const all = await db.list<Order>("orders");
  let total = 0, count = 0;
  for (const o of all) {
    if (o.status === "cancelled" || o.status === "returned") continue;
    // Unpaid online/bkash/nagad that are not delivered yet, or delivered but paymentStatus unpaid
    const unpaid = o.paymentStatus === "unpaid" || (!o.paymentStatus && o.payment !== "cod" && o.status !== "delivered");
    if (o.status === "delivered" && o.payment !== "cod" && o.paymentStatus === "unpaid") {
      total += o.total; count++;
    } else if (!["delivered", "cancelled", "returned"].includes(o.status) && o.payment !== "cod" && unpaid) {
      total += o.total; count++;
    }
  }
  return { total, count };
}

export async function profitLoss(from: string, to: string) {
  const [income, expenses] = await Promise.all([buildIncomeRows(from, to), listExpenses(from, to)]);
  const incomeTotal = sum(income);
  const expenseTotal = sum(expenses);
  const byIncomeCat: Record<string, number> = {};
  const byExpenseCat: Record<string, number> = {};
  for (const r of income) byIncomeCat[r.category] = (byIncomeCat[r.category] || 0) + r.amount;
  for (const e of expenses) byExpenseCat[e.category] = (byExpenseCat[e.category] || 0) + e.amount;
  return {
    from, to,
    incomeTotal,
    expenseTotal,
    netProfit: money(incomeTotal - expenseTotal),
    byIncomeCat,
    byExpenseCat,
    incomeCount: income.length,
    expenseCount: expenses.length,
  };
}

/** Cash-flow is cash-basis: delivered orders still awaiting payment verification are NOT cash in (see pendingReceivables). */
export async function cashflow(from: string, to: string) {
  const [income, expenses] = await Promise.all([buildIncomeRows(from, to, { cashBasis: true }), listExpenses(from, to)]);
  type Ev = { date: string; type: "in" | "out"; amount: number; label: string; id: string };
  const events: Ev[] = [];
  for (const r of income) events.push({ date: r.date, type: "in", amount: r.amount, label: r.category + (r.orderNo ? ` #${r.orderNo}` : ""), id: r.id });
  for (const e of expenses) events.push({ date: e.date, type: "out", amount: e.amount, label: e.category, id: e.id });
  events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let balance = 0;
  const rows = events.map((e) => {
    balance = money(balance + (e.type === "in" ? e.amount : -e.amount));
    return { ...e, balance };
  });
  return { from, to, rows, closingBalance: balance, totalIn: sum(income), totalOut: sum(expenses) };
}

/** Salaries and rider pay live in Staff Payroll / Rider Earnings. Typing them in again as a plain expense would count the cost twice. */
const PAYROLL_CATS = new Set(["staff salary", "rider payment", "salary", "salaries", "rider salary"]);
const assertNotPayroll = (category?: string) => {
  if (category && PAYROLL_CATS.has(category.trim().toLowerCase())) throw new ApiError(409, "Record salaries in Finance → Staff Payroll and rider pay in Finance → Rider Earnings. Entering them here too would count the cost twice.");
};

export async function createExpense(data: Omit<FinanceExpense, "id" | "createdAt" | "updatedAt">) {
  assertNotPayroll(data.category);
  const now = new Date().toISOString();
  if (!(data.amount > 0)) throw new ApiError(400, "Amount must be greater than 0");
  if (!data.date || !isRealDate(data.date)) throw new ApiError(400, "Valid date required");
  const rec: FinanceExpense = { ...data, id: newId(), createdAt: now, updatedAt: now, note: data.note || "", paymentMethod: data.paymentMethod || "cash" };
  await db.put("finance_expenses", rec);
  return rec;
}

const assertNotCourier = (id: string) => { if (id.startsWith("courier:")) throw new ApiError(409, "This expense is posted by Courier Accounts. Correct it there (Finance → Courier Accounts) so the audit history stays complete."); };

export async function updateExpense(id: string, data: Partial<FinanceExpense>) {
  assertNotCourier(id);
  const prev = await db.get<FinanceExpense>("finance_expenses", id);
  if (!prev) throw new ApiError(404, "Expense not found");
  if (data.category && data.category !== prev.category) assertNotPayroll(data.category);
  const next: FinanceExpense = {
    ...prev,
    category: data.category ?? prev.category,
    amount: data.amount ?? prev.amount,
    date: data.date ?? prev.date,
    paymentMethod: data.paymentMethod ?? prev.paymentMethod,
    note: data.note ?? prev.note,
    receiptUrl: data.receiptUrl !== undefined ? data.receiptUrl : prev.receiptUrl,
    orderId: data.orderId !== undefined ? data.orderId : prev.orderId,
    updatedAt: new Date().toISOString(),
  };
  if (!(next.amount > 0)) throw new ApiError(400, "Amount must be greater than 0");
  await db.put("finance_expenses", next);
  return next;
}

export async function deleteExpense(id: string) {
  assertNotCourier(id);
  const prev = await db.get<FinanceExpense>("finance_expenses", id);
  if (!prev) throw new ApiError(404, "Expense not found");
  await db.remove("finance_expenses", id);
  return prev;
}

/** Delivered orders are already counted automatically as sales; a manual income linked to one would count the same money twice. */
async function assertOrderLinkable(orderId?: string | null) {
  if (!orderId) return;
  const o = await db.get<Order>("orders", orderId);
  if (!o) throw new ApiError(404, "The linked order does not exist");
  if (isRevenueOrder(o)) throw new ApiError(409, `Order ${o.orderNo} is delivered and already counted as sales income. Do not record it again manually.`);
}

export async function createIncome(data: Omit<FinanceIncome, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  await assertOrderLinkable(data.orderId);
  if (!(data.amount > 0)) throw new ApiError(400, "Amount must be greater than 0");
  if (!data.date || !isRealDate(data.date)) throw new ApiError(400, "Valid date required");
  const rec: FinanceIncome = { ...data, id: newId(), createdAt: now, updatedAt: now, note: data.note || "", paymentMethod: data.paymentMethod || "cash" };
  await db.put("finance_incomes", rec);
  return rec;
}

export async function updateIncome(id: string, data: Partial<FinanceIncome>) {
  const prev = await db.get<FinanceIncome>("finance_incomes", id);
  if (!prev) throw new ApiError(404, "Income not found");
  if (data.orderId && data.orderId !== prev.orderId) await assertOrderLinkable(data.orderId);
  const next: FinanceIncome = {
    ...prev,
    category: data.category ?? prev.category,
    amount: data.amount ?? prev.amount,
    date: data.date ?? prev.date,
    paymentMethod: data.paymentMethod ?? prev.paymentMethod,
    note: data.note ?? prev.note,
    orderId: data.orderId !== undefined ? data.orderId : prev.orderId,
    updatedAt: new Date().toISOString(),
  };
  if (!(next.amount > 0)) throw new ApiError(400, "Amount must be greater than 0");
  await db.put("finance_incomes", next);
  return next;
}

export async function deleteIncome(id: string) {
  const prev = await db.get<FinanceIncome>("finance_incomes", id);
  if (!prev) throw new ApiError(404, "Income not found");
  await db.remove("finance_incomes", id);
  return prev;
}
