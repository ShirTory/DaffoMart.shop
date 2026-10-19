import { createHash, randomInt } from "crypto";
import { db, newId, StockError } from "./db";
import { ApiError } from "./http";
import { defaultSettings } from "./seed";
import { ORDER_STATUSES } from "@/lib/types";
import { paymentOptions } from "./payments";
import type { Courier, DeliveryZone, Offer, Order, OrderItem, Product, Rider, StockLog, StoreSettings } from "@/lib/types";
import type { orderCreateSchema } from "@/lib/validators";
import { riderApproved } from "@/lib/rider";
import type { z } from "zod";

export async function getSettings(): Promise<StoreSettings> {
  const s = await db.get<StoreSettings>("settings", "store");
  const m = { ...defaultSettings, ...(s ?? {}) };
  if (!Array.isArray(m.features) || m.features.length === 0) m.features = defaultSettings.features;
  if (!Array.isArray(m.homeSections) || m.homeSections.length === 0) m.homeSections = defaultSettings.homeSections;
  if (!m.labelRules) m.labelRules = defaultSettings.labelRules;
  // Old installs stored rose/amber/slate colours that never matched the logo and were never applied; treat them as "not set".
  for (const k of ["primaryColor", "accentColor", "secondaryColor"] as const) if (["#e11d48", "#f59e0b", "#0f172a"].includes(String(m[k] ?? "").toLowerCase())) m[k] = k === "primaryColor" ? "#1E3A8A" : k === "accentColor" ? "#F7941D" : "";
  return m;
}

/* ---------- Delivery zones ---------- */
export async function getZones(onlyActive = true): Promise<DeliveryZone[]> {
  const all = await db.list<DeliveryZone>("zones");
  return all.filter((z) => !onlyActive || z.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/* ---------- Offers / coupons ---------- */
export function offerIsLive(o: Offer, at = Date.now()) {
  if (!o.active) return false;
  if (o.startsAt && new Date(o.startsAt).getTime() > at) return false;
  if (o.endsAt && new Date(o.endsAt).getTime() + 86_400_000 <= at) return false; // end date is inclusive
  return true;
}
export async function evaluateCoupon(code: string, subtotal: number) {
  const offers = await db.list<Offer>("offers");
  const o = offers.find((x) => x.code && x.code === code.trim().toUpperCase());
  if (!o || !offerIsLive(o)) throw new ApiError(400, "This coupon code is invalid or has expired");
  if (subtotal < o.minOrder) throw new ApiError(400, `Add items worth ৳${o.minOrder} or more to use this coupon`);
  const raw = o.discountType === "percent" ? Math.round((subtotal * o.discountValue) / 100) : o.discountValue;
  return { offer: o, discount: Math.max(0, Math.min(raw, subtotal)) };
}

/* ---------- Orders ---------- */
const ORDER_NO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I: easy to read out over the phone
const orderNo = () => "DM-" + Array.from({ length: 7 }, () => ORDER_NO_ALPHABET[randomInt(ORDER_NO_ALPHABET.length)]).join("");
/** Same key => same order id, so a retried or double-submitted checkout can never create a second order. */
const orderIdFor = (key?: string) => (key ? createHash("sha256").update("order:" + key).digest("hex").slice(0, 16) : newId());

/** Stock is decremented and the order written in ONE atomic step (see db.placeOrder); there is no process-local lock to rely on. */
export function createOrder(input: z.infer<typeof orderCreateSchema>): Promise<Order> {
  return createOrderNow(input);
}

async function createOrderNow(input: z.infer<typeof orderCreateSchema>): Promise<Order> {
  const id = orderIdFor(input.idempotencyKey);
  if (input.idempotencyKey) { // a retry of an order that already went through: return it untouched (stock may have changed since)
    const prior = await db.get<Order>("orders", id);
    if (prior) return prior;
  }
  const [products, settings, zones] = await Promise.all([db.list<Product>("products"), getSettings(), getZones()]);
  const zone = zones.find((z) => z.id === input.zone);
  if (!zone) throw new ApiError(400, "Please choose a valid delivery area");
  const map = new Map(products.map((p) => [p.id, p]));
  // merge duplicate lines
  const qtyById = new Map<string, number>();
  for (const l of input.items) qtyById.set(l.id, (qtyById.get(l.id) ?? 0) + l.qty);

  const items: OrderItem[] = [];
  for (const [id, qty] of qtyById) {
    const p = map.get(id);
    if (!p || !p.active) throw new ApiError(400, "A product in your cart is no longer available. Please review your cart.");
    if (p.stock < qty) throw new ApiError(409, p.stock <= 0 ? `${p.name} is out of stock` : `Only ${p.stock} of ${p.name} left in stock`);
    items.push({ id: p.id, name: p.name, unit: p.unit, price: p.price, qty, image: p.image, emoji: p.emoji, ...(p.cost !== undefined ? { cost: p.cost } : {}) }); // cost snapshot feeds cost of goods sold
  }
  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  let discount = 0; let couponCode: string | undefined;
  if (input.couponCode) { const r = await evaluateCoupon(input.couponCode, subtotal); discount = r.discount; couponCode = r.offer.code; }
  if (settings.minOrder > 0 && subtotal < settings.minOrder) throw new ApiError(400, `Minimum order amount is ৳${settings.minOrder}`);
  const delivery = zone.freeOver > 0 && subtotal - discount >= zone.freeOver ? 0 : zone.charge;
  const serviceCharge = Math.max(0, Number(settings.serviceCharge) || 0);
  const opt = (await paymentOptions(settings)).find((p) => p.id === input.payment);
  if (!opt || opt.disabled) throw new ApiError(400, opt?.disabled ? "Online payment is not available yet. Please choose another payment method." : "This payment method is not available. Please choose another one.");
  // Manual mobile-money style methods: built-in bKash/Nagad, or any custom method that requires a TrxID
  const isManual = input.payment === "bkash" || input.payment === "nagad" || (input.payment !== "cod" && input.payment !== "online" && opt.requireTrx !== false);
  if (isManual) {
    if (!input.paymentRef || input.paymentRef.length < 6) throw new ApiError(400, "Enter the Transaction ID (TrxID) of your payment");
    if (!input.paymentFrom || !/^01[3-9]\d{8}$/.test(input.paymentFrom)) throw new ApiError(400, "Enter the mobile number you paid from (01XXXXXXXXX)");
    const trx = input.paymentRef.trim().toUpperCase();
    const reused = (await db.find<Order>("orders", "paymentRef", trx)).some((o) => o.id !== id && !RELEASES.has(o.status));
    if (reused) throw new ApiError(409, "This Transaction ID (TrxID) was already used for another order. Please check it and try again.");
  }
  const hasRx = items.some((i) => map.get(i.id)?.prescriptionRequired);
  const now = new Date().toISOString();
  const order: Order = {
    id, orderNo: orderNo(), name: input.name, phone: input.phone, address: input.address, zone: zone.id, zoneName: zone.name, ...(hasRx ? { hasRx: true } : {}),
    payment: input.payment, ...(["cod","bkash","nagad","online"].includes(input.payment) ? {} : { paymentLabel: opt.label }), paymentStatus: isManual ? "pending" : "unpaid",
    ...(isManual ? { paymentRef: input.paymentRef!.trim().toUpperCase(), paymentFrom: input.paymentFrom } : {}),
    ...(input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : {}), note: input.note ?? "", items, subtotal, delivery, serviceCharge, discount, ...(couponCode ? { couponCode } : {}),
    total: subtotal - discount + delivery + serviceCharge, status: "pending", createdAt: now, updatedAt: now,
  };
  // Authoritative stock check + decrement + order write: one atomic step, all or nothing.
  try {
    const r = await db.placeOrder(order, items.map((i) => ({ id: i.id, qty: i.qty })));
    return r.order;
  } catch (e) {
    if (e instanceof StockError) throw new ApiError(e.kind === "unavailable" ? 400 : 409, e.message);
    throw e;
  }
}

const RELEASES = new Set(["cancelled", "returned"]);
export async function setOrderStatus(id: string, status: Order["status"]) {
  if (!ORDER_STATUSES.includes(status)) throw new ApiError(400, "Invalid status");
  const at = new Date().toISOString();
  // The stock-restored flag is claimed inside ONE atomic update, so two simultaneous cancels can never both give the stock back.
  const flow: { move: "restore" | "take" | null } = { move: null };
  const updated = await db.mutate<Order>("orders", id, (cur) => {
    flow.move = null;
    if (!cur) return null;
    const next: Order = { ...cur, status, updatedAt: at };
    if (status === "delivered" && cur.status !== "delivered") next.deliveredAt = at; // revenue is dated by this, not by later edits
    if (status === "delivered" && cur.payment === "cod") next.paymentStatus = "paid"; // cash collected on delivery
    if (RELEASES.has(status) && !cur.stockRestored) { next.stockRestored = true; flow.move = "restore"; }
    else if (!RELEASES.has(status) && cur.stockRestored) { next.stockRestored = false; flow.move = "take"; }
    return next;
  });
  if (!updated) throw new ApiError(404, "Order not found");
  const move = flow.move;
  if (move) for (const i of updated.items) { // each product is changed atomically too
    await db.mutate<Product>("products", i.id, (p) => !p ? null : move === "restore"
      ? { ...p, stock: p.stock + i.qty, sold: Math.max(0, p.sold - i.qty) }
      : { ...p, stock: Math.max(0, p.stock - i.qty), sold: p.sold + i.qty });
  }
  return updated;
}

export async function setPaymentStatus(id: string, paymentStatus: NonNullable<Order["paymentStatus"]>) {
  const o = await db.get<Order>("orders", id);
  if (!o) throw new ApiError(404, "Order not found");
  return (await db.update<Order>("orders", id, { paymentStatus, updatedAt: new Date().toISOString() }))!;
}

/** Rider app: only the orders assigned to this rider. */
export async function riderOrders(riderId: string) {
  const all = await db.find<Order>("orders", "riderId", riderId);
  const done = new Set(["delivered", "returned", "cancelled"]);
  const active = all.filter((o) => !done.has(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const recent = all.filter((o) => done.has(o.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40);
  return { active, recent };
}
const NOT_STARTED = new Set(["pending", "confirmed", "processing"]);
export async function assignRider(id: string, riderId: string) {
  const o = await db.get<Order>("orders", id);
  if (!o) throw new ApiError(404, "Order not found");
  const patch: Partial<Order> = { updatedAt: new Date().toISOString() };
  if (!riderId) {
    Object.assign(patch, { riderId: "", riderName: "", riderPhone: "" });
    if (o.status === "assigned") patch.status = "processing";
  } else {
    const r = await db.get<Rider>("riders", riderId);
    if (!r) throw new ApiError(404, "Rider not found");
    if (!riderApproved(r)) throw new ApiError(400, "This rider has not been approved yet");
    if (!r.active) throw new ApiError(400, "This rider is marked inactive");
    Object.assign(patch, { riderId: r.id, riderName: r.name, riderPhone: r.phone });
    if (NOT_STARTED.has(o.status)) patch.status = "assigned";
  }
  return (await db.update<Order>("orders", id, patch))!;
}

/* ---------- Inventory ---------- */
export async function adjustStock(productId: string, mode: "add" | "remove" | "set", qty: number, reason: string) {
  const at = new Date().toISOString();
  let before = 0, after = 0, name = "";
  const product = await db.mutate<Product>("products", productId, (p) => { // atomic: a customer order in the same instant cannot be lost
    if (!p) return null;
    before = p.stock; name = p.name;
    after = Math.max(0, mode === "add" ? p.stock + qty : mode === "remove" ? p.stock - qty : qty);
    return { ...p, stock: after, updatedAt: at };
  });
  if (!product) throw new ApiError(404, "Product not found");
  const log: StockLog = { id: newId(), productId, productName: name, before, after, change: after - before, reason: reason || (mode === "add" ? "Restock" : mode === "remove" ? "Stock removed" : "Stock count"), createdAt: at };
  await db.put("stocklogs", log);
  return { product, log };
}

/* ---------- Dashboard stats ---------- */
const DHAKA = 6 * 3600_000;
const dayKey = (t: number | string) => new Date(new Date(t).getTime() + DHAKA).toISOString().slice(0, 10);

export async function dashboardStats(days = 14) {
  const [orders, products] = await Promise.all([db.list<Order>("orders"), db.list<Product>("products")]);
  const live = orders.filter((o) => !RELEASES.has(o.status));
  const today = dayKey(Date.now());
  const series: { date: string; orders: number; sales: number }[] = [];
  for (let i = days - 1; i >= 0; i--) series.push({ date: dayKey(Date.now() - i * 86_400_000), orders: 0, sales: 0 });
  const idx = new Map(series.map((s, i) => [s.date, i]));
  for (const o of live) { const k = idx.get(dayKey(o.createdAt)); if (k !== undefined) { series[k].orders++; series[k].sales += o.total; } }
  const half = Math.floor(days / 2);
  const cur = series.slice(-half).reduce((n, s) => n + s.sales, 0);
  const prev = series.slice(-half * 2, -half).reduce((n, s) => n + s.sales, 0);
  const statusBreakdown: Record<string, number> = {}; for (const s of ORDER_STATUSES) statusBreakdown[s] = 0;
  for (const o of orders) statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;
  const top = new Map<string, { id: string; name: string; image?: string; emoji?: string; qty: number; revenue: number }>();
  for (const o of live) for (const i of o.items) { const t = top.get(i.id) ?? { id: i.id, name: i.name, image: i.image, emoji: i.emoji, qty: 0, revenue: 0 }; t.qty += i.qty; t.revenue += i.price * i.qty; top.set(i.id, t); }
  const todayOrders = live.filter((o) => dayKey(o.createdAt) === today);
  return {
    totals: {
      revenue: orders.filter((o) => o.status === "delivered").reduce((n, o) => n + o.total, 0),
      sales: live.reduce((n, o) => n + o.total, 0),
      orders: orders.length, pending: statusBreakdown.pending,
      todayOrders: todayOrders.length, todaySales: todayOrders.reduce((n, o) => n + o.total, 0),
      customers: new Set(orders.map((o) => o.phone)).size,
      avgOrder: live.length ? Math.round(live.reduce((n, o) => n + o.total, 0) / live.length) : 0,
      products: products.length, activeProducts: products.filter((p) => p.active).length,
      outOfStock: products.filter((p) => p.active && p.stock <= 0).length,
    },
    trend: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0,
    series, statusBreakdown,
    topProducts: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    lowStock: products.filter((p) => p.active && p.stock <= 10).sort((a, b) => a.stock - b.stock).slice(0, 6).map((p) => ({ id: p.id, name: p.name, stock: p.stock, image: p.image, emoji: p.emoji, unit: p.unit })),
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
  };
}

/** Hand an order to a courier company (outside Dhaka). courierId "" removes the courier. Entering a tracking number marks it on the way. */
export async function setCourier(id: string, courierId?: string, trackingNo?: string) {
  const o = await db.get<Order>("orders", id);
  if (!o) throw new ApiError(404, "Order not found");
  const patch: Partial<Order> = { updatedAt: new Date().toISOString() };
  let cid = o.courierId;
  if (courierId !== undefined) {
    if (!courierId) { cid = undefined; Object.assign(patch, { courierId: undefined, courierName: undefined, trackingNo: undefined, courierUrl: undefined, courierAt: undefined }); }
    else { const c = await db.get<Courier>("couriers", courierId); if (!c) throw new ApiError(404, "Courier not found"); cid = c.id; Object.assign(patch, { courierId: c.id, courierName: c.name, courierAt: o.courierAt ?? patch.updatedAt }); }
  }
  if (cid) {
    const c = await db.get<Courier>("couriers", cid);
    const tn = trackingNo !== undefined ? trackingNo.trim() : o.trackingNo ?? "";
    patch.trackingNo = tn || undefined;
    patch.courierUrl = c?.trackingUrl && tn ? (c.trackingUrl.includes("{tracking}") ? c.trackingUrl.replace("{tracking}", encodeURIComponent(tn)) : c.trackingUrl) : undefined;
    if (tn && !o.trackingNo && ["pending", "confirmed", "processing", "assigned"].includes(o.status)) patch.status = "on_the_way";
  } else if (trackingNo) throw new ApiError(400, "Choose a courier first");
  return (await db.update<Order>("orders", id, patch))!;
}
