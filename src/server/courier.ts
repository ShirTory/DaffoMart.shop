import { db } from "./db";
import { ApiError } from "./http";
import { isRealDate, money, revenueDate, ymd } from "./finance";
import type { ChargePayer, CourierAuditEntry, CourierParcel, FinanceExpense, Order, ReturnState } from "@/lib/types";

/**
 * Courier accounts.
 *
 * Conventions (shown in the admin UI too):
 *  - A charge "paid by the customer" was paid to the courier by the customer directly. It is NOT a company cost and is NOT deducted from the courier's remittance.
 *  - A charge "paid by the company" is a company cost. The courier deducts it from the COD cash it remits.
 *  - COD collected = the COD amount of a DELIVERED parcel. Returned / cancelled / in-transit parcels collected nothing.
 *  - expected remittance = COD collected - company-paid delivery charge - company-paid return charge. Outstanding (courier receivable) = expected - amount received.
 *  - Delivered revenue is taken from the order itself (it is already in Accounts through the order); this module never adds revenue again.
 *  - Only VERIFIED parcels post their company-paid charges into Accounts (one expense per parcel, id "courier:<orderId>"), so re-syncing can never duplicate.
 */
export const COURIER_EXPENSE_PREFIX = "courier:";
export const isCourierExpense = (id: string) => id.startsWith(COURIER_EXPENSE_PREFIX);
const MAX = 1e7;

export type ParcelStatus = "in_transit" | "delivered" | "returned" | "cancelled";
export interface ParcelRow {
  orderId: string; orderNo: string; customer: string; courierId: string; courierName: string; trackingNo: string; orderStatus: string; parcelStatus: ParcelStatus;
  orderTotal: number; codAmount: number; codCollected: number; amountReceived: number;
  deliveryCharge: number; deliveryChargePaidBy: ChargePayer; returnStatus: ReturnState; returnCharge: number; returnChargePaidBy: ChargePayer;
  deliveredRevenue: number; companyDeliveryCharge: number; companyReturnCharge: number;
  /** company charge on a delivered parcel */ deliveryExpense: number;
  /** company charges (delivery + return) on a parcel that came back */ returnLoss: number;
  expectedRemittance: number; outstanding: number;
  verified: boolean; verifiedAt?: string; verifiedBy?: string; costDate: string; settlementRef: string; note: string; hasRecord: boolean; auditCount: number;
}

const nn = (v: unknown, label: string) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > MAX) throw new ApiError(400, `${label} must be a number between 0 and ${MAX.toLocaleString("en-US")}`);
  return money(n);
};

export function parcelStatusOf(o: Order, rec?: Pick<CourierParcel, "returnStatus"> | null): ParcelStatus {
  if (o.status === "delivered") return "delivered";
  if (o.status === "returned" || rec?.returnStatus === "returned") return "returned";
  if (o.status === "cancelled") return "cancelled";
  return "in_transit";
}

/** Default COD amount: the whole order total unless the customer already paid online. */
export const defaultCod = (o: Order) => (o.payment !== "cod" && o.paymentStatus === "paid" ? 0 : money(o.total || 0));

/** Pure: one parcel's figures from the order and its (optional) stored record. */
export function computeParcel(o: Order, rec?: CourierParcel | null): ParcelRow {
  const st = parcelStatusOf(o, rec);
  const cod = rec?.codAmount ?? defaultCod(o);
  const collected = st === "delivered" ? cod : 0;
  const dc = rec?.deliveryCharge ?? 0, rc = rec?.returnCharge ?? 0;
  const dPay = rec?.deliveryChargePaidBy ?? "company", rPay = rec?.returnChargePaidBy ?? "company";
  const compD = dPay === "company" ? dc : 0, compR = rPay === "company" ? rc : 0;
  const received = rec?.amountReceived ?? 0;
  const expected = money(collected - compD - compR);
  return {
    orderId: o.id, orderNo: o.orderNo, customer: o.name, courierId: o.courierId || "", courierName: o.courierName || "", trackingNo: o.trackingNo || "", orderStatus: o.status, parcelStatus: st,
    orderTotal: o.total || 0, codAmount: cod, codCollected: collected, amountReceived: received,
    deliveryCharge: dc, deliveryChargePaidBy: dPay, returnStatus: rec?.returnStatus ?? (st === "returned" ? "returned" : "none"), returnCharge: rc, returnChargePaidBy: rPay,
    deliveredRevenue: st === "delivered" ? o.total || 0 : 0, companyDeliveryCharge: compD, companyReturnCharge: compR,
    deliveryExpense: st === "returned" ? 0 : compD + compR, returnLoss: st === "returned" ? compD + compR : 0,
    expectedRemittance: expected, outstanding: money(expected - received),
    verified: rec?.verified === true, verifiedAt: rec?.verifiedAt, verifiedBy: rec?.verifiedBy,
    costDate: rec?.costDate || revenueDate(o) || ymd(o.createdAt), settlementRef: rec?.settlementRef || "", note: rec?.note || "", hasRecord: !!rec, auditCount: rec?.audit.length ?? 0,
  };
}

export interface CourierSummary {
  parcels: number; delivered: number; returned: number; inTransit: number;
  deliveredRevenue: number; codCollected: number; expectedRemittance: number; amountReceived: number;
  deliveryExpense: number; returnLoss: number; companyCourierCost: number;
  /** what couriers still owe us, split by whether the parcel figures are verified */
  receivableVerified: number; receivableUnverified: number; netSettlement: number;
  unverifiedParcels: number; costsMissing: number;
}
/** Pure: totals over parcel rows. Verified and unverified figures are kept apart; nothing is guessed. */
export function summarize(rows: ParcelRow[]): CourierSummary {
  const sum = (f: (r: ParcelRow) => number, rs = rows) => money(rs.reduce((n, r) => n + f(r), 0));
  const live = rows.filter((r) => r.parcelStatus !== "cancelled");
  return {
    parcels: live.length, delivered: live.filter((r) => r.parcelStatus === "delivered").length, returned: live.filter((r) => r.parcelStatus === "returned").length, inTransit: live.filter((r) => r.parcelStatus === "in_transit").length,
    deliveredRevenue: sum((r) => r.deliveredRevenue, live), codCollected: sum((r) => r.codCollected, live), expectedRemittance: sum((r) => r.expectedRemittance, live), amountReceived: sum((r) => r.amountReceived, live),
    deliveryExpense: sum((r) => r.deliveryExpense, live), returnLoss: sum((r) => r.returnLoss, live), companyCourierCost: sum((r) => r.companyDeliveryCharge + r.companyReturnCharge, live),
    receivableVerified: sum((r) => r.outstanding, live.filter((r) => r.verified)), receivableUnverified: sum((r) => r.outstanding, live.filter((r) => !r.verified)),
    netSettlement: sum((r) => r.amountReceived, live), unverifiedParcels: live.filter((r) => !r.verified).length,
    costsMissing: live.filter((r) => (r.parcelStatus === "delivered" || r.parcelStatus === "returned") && !r.hasRecord).length,
  };
}

const isCourierOrder = (o: Order) => !!o.courierId || !!o.courierName;
export async function courierRows(from?: string, to?: string, courierId?: string): Promise<ParcelRow[]> {
  const [orders, recs] = await Promise.all([db.list<Order>("orders"), db.list<CourierParcel>("courier_ledger")]);
  const byId = new Map(recs.map((r) => [r.id, r]));
  return orders.filter(isCourierOrder).filter((o) => !courierId || o.courierId === courierId)
    .map((o) => computeParcel(o, byId.get(o.id)))
    .filter((r) => (!from || r.costDate >= from) && (!to || r.costDate <= to))
    .sort((a, b) => b.costDate.localeCompare(a.costDate) || b.orderNo.localeCompare(a.orderNo));
}

export interface ParcelInput {
  codAmount?: unknown; amountReceived?: unknown; deliveryCharge?: unknown; deliveryChargePaidBy?: ChargePayer; returnStatus?: ReturnState; returnCharge?: unknown; returnChargePaidBy?: ChargePayer;
  costDate?: string; settlementRef?: string; note?: string; verified?: boolean; reason?: string;
}
const TRACKED = ["codAmount", "amountReceived", "deliveryCharge", "deliveryChargePaidBy", "returnStatus", "returnCharge", "returnChargePaidBy", "costDate", "settlementRef", "note", "verified"] as const;

/** Pure: apply an edit to a stored record (or create it). Throws ApiError for invalid input. */
export function applyParcelEdit(order: Order, cur: CourierParcel | null, inp: ParcelInput, by: string, nowIso: string): CourierParcel {
  const base: CourierParcel = cur ?? { id: order.id, amountReceived: 0, deliveryCharge: 0, deliveryChargePaidBy: "company", returnStatus: "none", returnCharge: 0, returnChargePaidBy: "company", verified: false, audit: [], createdAt: nowIso, updatedAt: nowIso };
  const next: CourierParcel = { ...base };
  if (inp.codAmount !== undefined && inp.codAmount !== null && inp.codAmount !== "") next.codAmount = nn(inp.codAmount, "COD amount");
  if (inp.amountReceived !== undefined) next.amountReceived = nn(inp.amountReceived, "Amount received");
  if (inp.deliveryCharge !== undefined) next.deliveryCharge = nn(inp.deliveryCharge, "Delivery charge");
  if (inp.returnCharge !== undefined) next.returnCharge = nn(inp.returnCharge, "Return charge");
  if (inp.deliveryChargePaidBy) next.deliveryChargePaidBy = inp.deliveryChargePaidBy;
  if (inp.returnChargePaidBy) next.returnChargePaidBy = inp.returnChargePaidBy;
  if (inp.returnStatus) next.returnStatus = inp.returnStatus;
  if (inp.costDate !== undefined) { if (inp.costDate && !isRealDate(inp.costDate)) throw new ApiError(400, "Cost date must be a real date"); next.costDate = inp.costDate || undefined; }
  if (inp.settlementRef !== undefined) next.settlementRef = inp.settlementRef.trim().slice(0, 80) || undefined;
  if (inp.note !== undefined) next.note = inp.note.trim().slice(0, 400) || undefined;
  const st = parcelStatusOf(order, next);
  if (next.returnStatus === "returned" && st === "delivered") throw new ApiError(409, "This order is marked delivered, so it cannot also be a returned parcel. Change the order status first.");
  if (next.returnCharge > 0 && next.returnStatus === "none") throw new ApiError(400, "A return charge needs a return status (in transit or returned).");
  if (next.amountReceived > 0 && st !== "delivered" && st !== "returned") throw new ApiError(400, "Amount received can only be entered for a delivered or returned parcel.");
  const cod = next.codAmount ?? defaultCod(order);
  const deducted = (next.deliveryChargePaidBy === "company" ? next.deliveryCharge : 0) + (next.returnChargePaidBy === "company" ? next.returnCharge : 0);
  if (st === "delivered" && next.amountReceived > cod + 0.005) throw new ApiError(400, `Amount received (৳${next.amountReceived}) cannot be more than the COD amount (৳${cod}).`);
  if (st === "delivered" && deducted > cod + 0.005) throw new ApiError(400, "Company-paid charges are larger than the COD amount; check the charges.");
  if (inp.verified !== undefined) {
    next.verified = inp.verified;
    if (inp.verified) { next.verifiedAt = nowIso; next.verifiedBy = by; } else { next.verifiedAt = undefined; next.verifiedBy = undefined; }
  }
  const changes: Record<string, [unknown, unknown]> = {};
  for (const k of TRACKED) { const a = (base as any)[k], b = (next as any)[k]; if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changes[k] = [a ?? null, b ?? null]; }
  if (!cur && !Object.keys(changes).length) changes.created = [null, true];
  if (!Object.keys(changes).length) return cur as CourierParcel; // nothing changed: no audit entry, no write
  const wasVerified = base.verified;
  const reason = (inp.reason || "").trim().slice(0, 300);
  const onlyVerifyFlag = Object.keys(changes).every((k) => k === "verified");
  if ((wasVerified && !onlyVerifyFlag) || (wasVerified && inp.verified === false)) {
    if (!reason) throw new ApiError(400, "This parcel is verified. Give a reason to correct it (the change is kept in the audit history).");
  }
  const action: CourierAuditEntry["action"] = !cur ? "create" : changes.verified ? (next.verified ? "verify" : "unverify") : "edit";
  next.audit = [...base.audit, { at: nowIso, by, action, ...(reason ? { reason } : {}), changes }].slice(-100);
  next.updatedAt = nowIso;
  return next;
}

/** The single Accounts expense a verified parcel owns, or null when nothing should be posted. */
export function parcelExpense(o: Order, rec: CourierParcel, by: string, nowIso: string): FinanceExpense | null {
  const row = computeParcel(o, rec);
  const amount = money(row.companyDeliveryCharge + row.companyReturnCharge);
  if (!rec.verified || !(amount > 0)) return null;
  const parts = [row.companyDeliveryCharge > 0 ? `delivery ৳${row.companyDeliveryCharge}` : "", row.companyReturnCharge > 0 ? `return ৳${row.companyReturnCharge}` : ""].filter(Boolean).join(" + ");
  return { id: COURIER_EXPENSE_PREFIX + o.id, category: "Delivery Cost", amount, date: row.costDate, paymentMethod: "cod", orderId: o.id, note: `Courier ${o.courierName || ""} ${o.trackingNo || ""} (${parts}) - synced from Courier Accounts`.replace(/\s+/g, " ").trim(), createdBy: by, createdAt: nowIso, updatedAt: nowIso };
}

/** Make Accounts match the parcel: upsert the one expense, or remove it when it no longer applies. Idempotent. */
export async function syncParcelToAccounts(order: Order, rec: CourierParcel, by: string) {
  const id = COURIER_EXPENSE_PREFIX + order.id;
  const now = new Date().toISOString();
  const want = parcelExpense(order, rec, by, now);
  if (!want) { if (await db.get("finance_expenses", id)) await db.remove("finance_expenses", id); return null; }
  await db.mutate("finance_expenses", id, (cur: FinanceExpense | null) => ({ ...want, createdAt: cur?.createdAt ?? now, createdBy: cur?.createdBy ?? by }));
  return want;
}

export async function saveParcel(orderId: string, inp: ParcelInput, by: string) {
  const order = await db.get<Order>("orders", orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (!isCourierOrder(order)) throw new ApiError(400, "This order has no courier assigned. Assign a courier from Orders first.");
  const now = new Date().toISOString();
  let out: CourierParcel | null = null;
  await db.mutate("courier_ledger", orderId, (cur: CourierParcel | null) => { out = applyParcelEdit(order, cur, inp, by, now); return out === cur ? null : out; });
  const rec = out ?? (await db.get<CourierParcel>("courier_ledger", orderId));
  if (!rec) throw new ApiError(500, "Could not save the parcel");
  await syncParcelToAccounts(order, rec, by);
  return computeParcel(order, rec);
}

export async function parcelHistory(orderId: string) { return (await db.get<CourierParcel>("courier_ledger", orderId))?.audit ?? []; }

/** Manual "Delivery Cost" expenses linked to an order that a verified courier record also posts: the cost would be counted twice. */
export async function doubleCountWarnings(rows: ParcelRow[]) {
  const exp = await db.list<FinanceExpense>("finance_expenses");
  const synced = new Set(rows.filter((r) => r.verified && r.companyDeliveryCharge + r.companyReturnCharge > 0).map((r) => r.orderId));
  return exp.filter((e) => !isCourierExpense(e.id) && e.orderId && synced.has(e.orderId) && /delivery|courier/i.test(e.category)).map((e) => ({ expenseId: e.id, orderId: e.orderId as string, amount: e.amount, category: e.category }));
}
