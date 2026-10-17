import { db } from "@/server/db";
import { normPhone } from "@/lib/format";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import type { DeliveryZone, Order, OrderIssue, Rider, RiderRating } from "@/lib/types";
export const dynamic = "force-dynamic";

const CANCEL_WINDOW_MS = 2 * 60_000;

/** Public order tracking: needs BOTH order number and the phone used at checkout. */
export const GET = handle(async (req) => {
  rateLimit(`track:${clientIp(req)}`, 20, 10 * 60_000);
  const u = new URL(req.url).searchParams; const no = (u.get("no") ?? "").trim().toUpperCase(), phone = normPhone((u.get("phone") ?? "").trim());
  if (!no || !phone) throw new ApiError(400, "Enter your order number and phone number");
  const o = (await db.list<Order>("orders")).find((x) => x.orderNo === no && x.phone === phone);
  if (!o) throw new ApiError(404, "No order found with these details");
  const needRider = o.riderId && ["assigned", "picked_up", "on_the_way", "delivered"].includes(o.status);
  const r = needRider ? await db.get<Rider>("riders", o.riderId!) : null;
  const ageSec = r?.locAt ? Math.max(0, Math.round((Date.now() - new Date(r.locAt).getTime()) / 1000)) : null;
  const riderLoc = r && typeof r.lat === "number" && typeof r.lng === "number" && ageSec !== null && ageSec < 900 ? { lat: r.lat, lng: r.lng, ageSec } : null;
  const zone = o.zone ? await db.get<DeliveryZone>("zones", o.zone) : null;
  const ageMs = Date.now() - new Date(o.createdAt).getTime();
  const canCancel = o.status === "pending" && ageMs <= CANCEL_WINDOW_MS;
  const cancelEndsAt = canCancel ? new Date(new Date(o.createdAt).getTime() + CANCEL_WINDOW_MS).toISOString() : undefined;

  // existing rating / issues for this order
  const existingRating = o.status === "delivered" && o.riderId
    ? (await db.list<RiderRating>("ratings")).find((x) => x.orderId === o.id)
    : null;
  const issues = (await db.list<OrderIssue>("issues")).filter((i) => i.orderId === o.id);

  return ok({
    id: o.id,
    ...(typeof o.lat === "number" && typeof o.lng === "number" ? { dest: { lat: o.lat, lng: o.lng } } : {}),
    ...(riderLoc ? { riderLoc } : {}),
    orderNo: o.orderNo, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt,
    items: o.items, subtotal: o.subtotal, delivery: o.delivery, serviceCharge: o.serviceCharge ?? 0, discount: o.discount, total: o.total,
    payment: o.payment, paymentStatus: o.paymentStatus, zoneName: o.zoneName,
    ...(zone?.eta ? { eta: zone.eta } : {}),
    canCancel, ...(cancelEndsAt ? { cancelEndsAt } : {}),
    ...(o.courierName ? { courierName: o.courierName, ...(o.trackingNo ? { trackingNo: o.trackingNo } : {}), ...(o.courierUrl ? { courierUrl: o.courierUrl } : {}) } : {}),
    ...(o.riderId && o.riderName ? {
      riderId: o.riderId,
      riderName: o.riderName,
      riderPhone: o.riderPhone,
      riderImage: r?.image,
      riderRatingAvg: r?.ratingAvg,
      riderRatingCount: r?.ratingCount,
    } : {}),
    rated: !!existingRating,
    existingRating: existingRating ? { stars: existingRating.stars, comment: existingRating.comment } : null,
    issues: issues.map((i) => ({ id: i.id, text: i.text, status: i.status, photos: i.photos, createdAt: i.createdAt })),
  });
});
