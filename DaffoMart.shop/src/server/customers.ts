/**
 * Customer Database (CRM). One record per customer, keyed by the normalized phone number (01XXXXXXXXX):
 * the document id IS the phone, so two records for the same number cannot exist (atomic create-if-absent).
 * Orders are linked through `order.customerId`; the numbers on the record (order count, total spent, last order)
 * are always recomputed from the customer's real orders, never incremented, so retries cannot double count.
 */
import { db, newId } from "./db";
import { ApiError } from "./http";
import { normalizeBdPhone } from "@/lib/phone";
import type { Customer, CustomerFollowUp, CustomerSegment, CustomerSource, CustomerStatus, Order } from "@/lib/types";

/** Segment rules (automatic unless the admin picks a segment on the customer). */
export const CRM_RULES = { vipSpend: 20000, vipOrders: 10, regularOrders: 3, inactiveDays: 90 } as const;
export const SEGMENTS: CustomerSegment[] = ["new", "regular", "vip", "inactive"];
export const STATUSES: CustomerStatus[] = ["active", "inactive", "blocked"];
const COUNTED = (o: Order) => o.status !== "cancelled" && o.status !== "returned";
const now = () => new Date().toISOString();

export function segmentOf(c: Pick<Customer, "orderCount" | "totalSpent" | "lastOrderAt" | "segmentOverride">, at = Date.now()): CustomerSegment {
  if (c.segmentOverride) return c.segmentOverride;
  if (c.orderCount > 0 && c.lastOrderAt && at - Date.parse(c.lastOrderAt) > CRM_RULES.inactiveDays * 86_400_000) return "inactive";
  if (c.totalSpent >= CRM_RULES.vipSpend || c.orderCount >= CRM_RULES.vipOrders) return "vip";
  if (c.orderCount >= CRM_RULES.regularOrders) return "regular";
  return "new";
}

/* ---------- input validation (pure; shared by the admin form, the API and Excel import) ---------- */
export interface CustomerInput { phone?: string; name?: string; whatsapp?: string; email?: string; address?: string; area?: string; notes?: string; status?: CustomerStatus; segmentOverride?: CustomerSegment | "" }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Validates the fields that are PRESENT in `raw`. `creating` requires phone + name. Returns friendly messages, never throws. */
export function parseCustomerInput(raw: Record<string, unknown>, creating: boolean): { value: CustomerInput; errors: Record<string, string> } {
  const v: CustomerInput = {}; const errors: Record<string, string> = {};
  const has = (k: string) => raw[k] !== undefined && raw[k] !== null;
  if (creating || has("phone")) { const p = normalizeBdPhone(raw.phone); if (!p) errors.phone = "Enter a valid mobile number (01XXXXXXXXX)"; else v.phone = p; }
  if (creating || has("name")) { const n = clip(raw.name, 80); if (n.length < 2) errors.name = "Name must be at least 2 characters"; else v.name = n; }
  if (has("whatsapp")) { const w = clip(raw.whatsapp, 30); if (!w) v.whatsapp = ""; else { const n = normalizeBdPhone(w); if (!n) errors.whatsapp = "Enter a valid WhatsApp number (01XXXXXXXXX)"; else v.whatsapp = n; } }
  if (has("email")) { const e = clip(raw.email, 120).toLowerCase(); if (e && !EMAIL.test(e)) errors.email = "Enter a valid email address"; else v.email = e; }
  if (has("address")) v.address = clip(raw.address, 300);
  if (has("area")) v.area = clip(raw.area, 80);
  if (has("notes")) v.notes = clip(raw.notes, 2000);
  if (has("status")) { const s = clip(raw.status, 20).toLowerCase() as CustomerStatus; if (!STATUSES.includes(s)) errors.status = "Status must be active, inactive or blocked"; else v.status = s; }
  if (has("segmentOverride")) { const s = clip(raw.segmentOverride, 20).toLowerCase() as CustomerSegment; if (s && !SEGMENTS.includes(s)) errors.segmentOverride = "Segment must be new, regular, vip or inactive"; else v.segmentOverride = s; }
  return { value: v, errors };
}

const blank = (phone: string, name: string, source: CustomerSource): Customer => ({ id: phone, phone, name, followUps: [], status: "active", source, orderCount: 0, totalSpent: 0, createdAt: now(), updatedAt: now() });

/* ---------- order -> customer ---------- */
/** Recomputes the numbers on a customer from their real orders. Safe to call any number of times. */
export async function recomputeCustomerStats(phone: string) {
  const orders = (await db.find<Order>("orders", "phone", phone)).filter(COUNTED);
  const dates = orders.map((o) => o.createdAt).sort();
  const stats = { orderCount: orders.length, totalSpent: Math.round(orders.reduce((n, o) => n + (Number(o.total) || 0), 0)), firstOrderAt: dates[0], lastOrderAt: dates[dates.length - 1] };
  return db.mutate<Customer>("customers", phone, (cur) => (cur ? { ...cur, ...stats, updatedAt: now() } : null));
}

/** Called after an order is saved: creates the customer when new (never a duplicate), refreshes contact details, recomputes totals. */
export async function recordOrderCustomer(o: Pick<Order, "phone" | "name" | "address" | "zoneName">) {
  const phone = normalizeBdPhone(o.phone); if (!phone) return null;
  await db.create<Customer>("customers", { ...blank(phone, o.name, "order"), address: o.address, area: o.zoneName || "" });
  await db.mutate<Customer>("customers", phone, (cur) => cur ? ({ ...cur, name: cur.name || o.name, address: o.address || cur.address, area: o.zoneName || cur.area, updatedAt: now() }) : null);
  return recomputeCustomerStats(phone);
}

/** Checkout guard: an admin can block a customer. */
export async function assertCustomerMayOrder(phone: string) {
  const c = await db.get<Customer>("customers", phone);
  if (c?.status === "blocked") throw new ApiError(403, "We cannot accept this order online. Please call us to place it.");
}

/** One-off / repeatable backfill: builds customers from every existing order. Idempotent. */
export async function syncCustomersFromOrders() {
  const orders = (await db.list<Order>("orders")).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = new Map<string, Order>(); for (const o of orders) { const p = normalizeBdPhone(o.phone); if (p) latest.set(p, o); }
  let created = 0, updated = 0;
  for (const [phone, o] of latest) {
    const existed = await db.get<Customer>("customers", phone);
    await db.create<Customer>("customers", { ...blank(phone, o.name, "order"), address: o.address, area: o.zoneName || "", createdAt: orders.find((x) => normalizeBdPhone(x.phone) === phone)?.createdAt || now() });
    await recomputeCustomerStats(phone);
    existed ? updated++ : created++;
    for (const x of orders) if (normalizeBdPhone(x.phone) === phone && x.customerId !== phone) await db.update<Order>("orders", x.id, { customerId: phone } as Partial<Order>);
  }
  return { customers: latest.size, created, updated };
}

/* ---------- admin CRUD ---------- */
export type CustomerView = Customer & { segment: CustomerSegment };
export const present = (c: Customer, at = Date.now()): CustomerView => ({ ...c, followUps: c.followUps ?? [], segment: segmentOf(c, at) });

export interface CustomerQuery { q?: string; segment?: string; status?: string; area?: string }
export function filterCustomers(list: Customer[], f: CustomerQuery, at = Date.now()): CustomerView[] {
  const q = (f.q ?? "").trim().toLowerCase(); const qd = q.replace(/\D/g, "");
  return list.map((c) => present(c, at)).filter((c) =>
    (!f.segment || c.segment === f.segment) && (!f.status || c.status === f.status) && (!f.area || (c.area ?? "").toLowerCase() === f.area.toLowerCase()) &&
    (!q || c.name.toLowerCase().includes(q) || (qd.length >= 3 && (c.phone.includes(qd) || (c.whatsapp ?? "").includes(qd))) || (c.email ?? "").includes(q) || (c.address ?? "").toLowerCase().includes(q) || (c.area ?? "").toLowerCase().includes(q))
  ).sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt));
}

export async function createCustomer(raw: Record<string, unknown>, source: CustomerSource = "manual") {
  const { value, errors } = parseCustomerInput(raw, true);
  if (Object.keys(errors).length) throw new ApiError(400, Object.values(errors)[0], errors);
  const rec: Customer = { ...blank(value.phone!, value.name!, source), whatsapp: value.whatsapp || undefined, email: value.email || undefined, address: value.address || undefined, area: value.area || undefined, notes: value.notes || undefined, status: value.status ?? "active", segmentOverride: (value.segmentOverride || undefined) as CustomerSegment | undefined };
  if (!(await db.create<Customer>("customers", rec))) throw new ApiError(409, "A customer with this phone number already exists", { phone: "Already exists", existingId: value.phone! });
  return recomputeCustomerStats(rec.id).then((c) => c ?? rec);
}

export async function updateCustomer(id: string, raw: Record<string, unknown>) {
  if ("phone" in raw && raw.phone !== undefined) { const p = normalizeBdPhone(raw.phone); if (p !== id) throw new ApiError(400, "The phone number is the customer's ID and cannot be changed. Add a new customer instead.", { phone: "Cannot be changed" }); }
  const { value, errors } = parseCustomerInput({ ...raw, phone: undefined }, false);
  if (Object.keys(errors).length) throw new ApiError(400, Object.values(errors)[0], errors);
  const { phone: _p, segmentOverride, ...patch } = value;
  const followUps = Array.isArray(raw.followUps) ? sanitizeFollowUps(raw.followUps) : undefined;
  const next = await db.mutate<Customer>("customers", id, (cur) => cur ? ({
    ...cur, ...clean(patch), ...(segmentOverride !== undefined ? { segmentOverride: segmentOverride || undefined } : {}), ...(followUps ? { followUps } : {}), updatedAt: now(),
  }) : null);
  if (!next) throw new ApiError(404, "Customer not found");
  return next;
}
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Follow-ups arrive as a whole list from the admin form; ids / authors of NEW entries are assigned server-side. */
export function sanitizeFollowUps(list: unknown[], by = "admin"): CustomerFollowUp[] {
  return list.slice(0, 100).map((x: any) => ({
    id: /^[a-f0-9]{16}$/.test(String(x?.id)) ? String(x.id) : newId(), text: clip(x?.text, 500), dueAt: /^\d{4}-\d{2}-\d{2}$/.test(String(x?.dueAt ?? "")) ? String(x.dueAt) : undefined,
    done: Boolean(x?.done), by: clip(x?.by, 120) || by, at: typeof x?.at === "string" && !Number.isNaN(Date.parse(x.at)) ? x.at : now(),
  })).filter((f) => f.text);
}

/** Upsert used by Excel import: creates by phone or fills in the provided (non-blank) fields. Blank cells never erase data. */
export async function upsertCustomerFromImport(raw: Record<string, unknown>) {
  const { value, errors } = parseCustomerInput(raw, true);
  if (Object.keys(errors).length) throw new ApiError(400, Object.values(errors)[0], errors);
  const { segmentOverride, ...patch } = clean(Object.fromEntries(Object.entries(value).filter(([k, v]) => k !== "phone" && v !== "" && v !== undefined)) as CustomerInput);
  const seg = (segmentOverride || undefined) as CustomerSegment | undefined;
  const created = await db.create<Customer>("customers", { ...blank(value.phone!, value.name!, "import"), ...patch, segmentOverride: seg } as Customer);
  if (created) { await recomputeCustomerStats(value.phone!); return "created" as const; }
  await db.mutate<Customer>("customers", value.phone!, (cur) => cur ? ({ ...cur, ...patch, ...(seg ? { segmentOverride: seg } : {}), updatedAt: now() }) : null);
  return "updated" as const;
}
