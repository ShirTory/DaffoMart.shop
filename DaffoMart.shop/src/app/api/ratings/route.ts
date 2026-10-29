import { db, newId } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { getFullAdmin, requireAdmin } from "@/server/auth";
import { riderRatingSchema } from "@/lib/validators";
import { normPhone } from "@/lib/format";
import type { Order, Rider, RiderRating } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const riderId = url.searchParams.get("riderId") || undefined;
  const orderId = url.searchParams.get("orderId") || undefined;
  let list = riderId ? await db.find<RiderRating>("ratings", "riderId", riderId) : orderId ? await db.find<RiderRating>("ratings", "orderId", orderId) : await db.list<RiderRating>("ratings");
  if (riderId && orderId) list = list.filter((r) => r.orderId === orderId);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!riderId && !orderId) await requireAdmin();
  // Customers' phone numbers are private: only full-access admins get them.
  if (!(await getFullAdmin())) return ok(list.map(({ customerPhone, ...r }) => ({ ...r, customerName: r.customerName ? r.customerName.split(" ")[0] : undefined })));
  return ok(list);
});

export const POST = handle(async (req) => {
  rateLimit(`rating:${clientIp(req)}`, 20, 60 * 60_000);
  const body = riderRatingSchema.parse(await readJson(req));
  const order = await db.get<Order>("orders", body.orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== "delivered") throw new ApiError(400, "You can only rate after delivery");
  if (!order.riderId) throw new ApiError(400, "No rider was assigned to this order");
  if (!body.customerPhone || normPhone(body.customerPhone) !== order.phone) throw new ApiError(403, "Enter the phone number used for this order to rate it"); // ownership check
  const existing = (await db.find<RiderRating>("ratings", "orderId", order.id))[0];
  if (existing) throw new ApiError(409, "You already rated this delivery");
  const at = new Date().toISOString();
  const rec: RiderRating = {
    id: newId(), orderId: order.id, orderNo: order.orderNo, riderId: order.riderId,
    riderName: order.riderName, stars: body.stars, comment: body.comment,
    customerName: order.name, customerPhone: order.phone, createdAt: at,
  };
  await db.put("ratings", rec);
  const all = await db.find<RiderRating>("ratings", "riderId", order.riderId);
  const count = all.length;
  const avg = all.reduce((s, r) => s + r.stars, 0) / count;
  await db.update<Rider>("riders", order.riderId, { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count });
  return ok(rec, 201);
});
