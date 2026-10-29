import { createHash, randomInt } from "crypto";
import { db, newId, StockError } from "./db";
import { ApiError } from "./http";
import { defaultSettings } from "./seed";
import { ORDER_STATUSES } from "@/lib/types";
import { paymentOptions } from "./payments";
import type { Courier, DeliveryZone, Offer, Order, OrderItem, Product, Rider, StockLog, StoreSettings } from "@/lib/types";
import type { orderCreateSchema } from "@/lib/validators";
import { findVariant, hasVariants, variantLabel, variantStockProblem, withVariantStock } from "@/lib/variants";
import { riderApproved } from "@/lib/rider";
import { assertCustomerMayOrder, recomputeCustomerStats, recordOrderCustomer } from "./customers";
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
  await assertCustomerMayOrder(input.phone); // an admin can block a customer in the CRM
  const [products, settings, zones] = await Promise.all([db.list<Product>("products"), getSettings(), getZones()]);
  const zone = zones.find((z) => z.id === input.zone);
  if (!zone) throw new ApiError(400, "Please choose a valid delivery area");
  const map = new Map(products.map((p) => [p.id, p]));
  // merge duplicate lines (same product AND same variant)
  const lines = new Map<string, { id: string; variantId?: string; qty: number }>();
  for (const l of input.items) {
    const k = `${l.id}~${l.variantId ?? ""}`;
    const cur = lines.get(k); if (cur) cur.qty += l.qty; else lines.set(k, { id: l.id, variantId: l.variantId || undefined, qty: l.qty });
  }
  // stock is checked per variant, but a product's lines may be spread over several variants: total per variant is what counts
  const items: OrderItem[] = [];
  for (const { id, variantId, qty } of lines.values()) {
    const p = map.get(id);
    if (!p || !p.active) throw new ApiError(400, "A product in your cart is no longer available. Please review your cart.");
    let price = p.price, unit = p.unit, vFields: Pick<OrderItem, "variantId" | "variantLabel"> = {};
    if (hasVariants(p)) {
      const problem = variantStockProblem(p, variantId, qty);
      if (problem) throw new ApiError(!variantId || !findVariant(p, variantId) ? 400 : 409, problem);
      const v = findVariant(p, variantId)!; // the price ALWAYS comes from the server's copy of the chosen variant, never from the browser
      price = v.price; unit = variantLabel(v); vFields = { variantId: v.id, variantLabel: variantLabel(v) };
    } else {
      if (variantId) throw new ApiError(400, "An option in your cart is no longer available. Please review your cart.");
      if (p.stock < qty) throw new ApiError(409, p.stock <= 0 ? `${p.name} is out of stock` : `Only ${p.stock} of ${p.name} left in stock`);
    }
    items.push({ id: p.id, name: p.name, unit, price, qty, image: p.image, emoji: p.emoji, ...vFields, ...(p.cost !== undefined ? { cost: p.cost } : {}) }); // cost snapshot feeds cost of goods sold
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
    id, orderNo: orderNo(), customerId: input.phone, name: input.name, phone: input.phone, address: input.address, zone: zone.id, zoneName: zone.name, ...(hasRx ? { hasRx: true } : {}),
    payment: input.payment, ...(["cod","bkash","nagad","online"].includes(input.payment) ? {} : { paymentLabel: opt.label }), paymentStatus: isManual ? "pending" : "unpaid",
    ...(isManual ? { paymentRef: input.paymentRef!.trim().toUpperCase(), paymentFrom: input.paymentFrom } : {}),
    ...(input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : {}), note: input.note ?? "", items, subtotal, delivery, serviceCharge, discount, ...(couponCode ? { couponCode } : {}),
    total: subtotal - discount + delivery + serviceCharge, status: "pending", createdAt: now, updatedAt: now,
  };
  // Authoritative stock check + decrement + order write: one atomic step, all or nothing.
  try {
    const r = await db.placeOrder(order, items.map((i) => ({ id: i.id, qty: i.qty, variantId: i.variantId })));
    // CRM: save / refresh the customer. The order is already safely stored, so a CRM problem must never fail the checkout.
    if (!r.duplicate) { try { await recordOrderCustomer(r.order); } catch (e) { console.error("[crm] could not record customer for order", r.order.orderNo, e); } }
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
  try { await recomputeCustomerStats(updated.phone); } catch (e) { console.error("[crm] stats refresh failed", e); } // cancelled / returned orders leave the customer's totals
  const move = flow.move;
  if (move) for (const i of updated.items) { // each product is changed atomically too
    await db.mutate<Product>("products", i.id, (p) => {
      if (!p) return null;
      const delta = move === "restore" ? i.qty : -i.qty;
      const sold = move === "restore" ? Math.max(0, p.sold - i.qty) : p.sold + i.qty;
      if (i.variantId) { const w = withVariantStock(p, i.variantId, delta); return w ? { ...p, ...w, sold } : { ...p, sold }; } // variant gone since: only the sold counter moves
      return { ...p, stock: Math.max(0, p.stock + delta), sold };
    });
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
export async function adjustStock(productId: string, mode: "add" | "remove" | "set", qty: number, reason: string, variantId?: string) {
  const at = new Date().toISOString();
  let before = 0, after = 0, name = "", problem = "";
  const product = await db.mutate<Product>("products", productId, (p) => { // atomic: a customer order in the same instant cannot be lost
    problem = "";
    if (!p) return null;
    name = p.name;
    if (hasVariants(p)) {
      const v = findVariant(p, variantId);
      if (!v) { problem = variantId ? "That variant no longer exists" : "This product has variants: choose which one to adjust"; return null; }
      before = v.stock; name = `${p.name} (${variantLabel(v)})`;
      after = Math.max(0, mode === "add" ? v.stock + qty : mode === "remove" ? v.stock - qty : qty);
      return { ...p, ...withVariantStock(p, v.id, after - before)!, updatedAt: at };
    }
    before = p.stock;
    after = Math.max(0, mode === "add" ? p.stock + qty : mode === "remove" ? p.stock - qty : qty);
    return { ...p, stock: after, updatedAt: at };
  });
  if (problem) throw new ApiError(400, problem);
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
