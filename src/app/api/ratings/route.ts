import { db, newId } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { riderRatingSchema } from "@/lib/validators";
import type { Order, Rider, RiderRating } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const riderId = url.searchParams.get("riderId") || undefined;
  const orderId = url.searchParams.get("orderId") || undefined;
  let list = await db.list<RiderRating>("ratings");
  if (riderId) list = list.filter((r) => r.riderId === riderId);
  if (orderId) list = list.filter((r) => r.orderId === orderId);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!riderId && !orderId) await requireAdmin();
  return ok(list);
});

export const POST = handle(async (req) => {
  rateLimit(`rating:${clientIp(req)}`, 20, 60 * 60_000);
  const body = riderRatingSchema.parse(await req.json());
  const order = await db.get<Order>("orders", body.orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== "delivered") throw new ApiError(400, "You can only rate after delivery");
  if (!order.riderId) throw new ApiError(400, "No rider was assigned to this order");
  const existing = (await db.list<RiderRating>("ratings")).find((r) => r.orderId === order.id);
  if (existing) throw new ApiError(409, "You already rated this delivery");
  const at = new Date().toISOString();
  const rec: RiderRating = {
    id: newId(), orderId: order.id, orderNo: order.orderNo, riderId: order.riderId,
    riderName: order.riderName, stars: body.stars, comment: body.comment,
    customerName: body.customerName || order.name, customerPhone: body.customerPhone || order.phone, createdAt: at,
  };
  await db.put("ratings", rec);
  const all = (await db.list<RiderRating>("ratings")).filter((r) => r.riderId === order.riderId);
  const count = all.length;
  const avg = all.reduce((s, r) => s + r.stars, 0) / count;
  await db.update<Rider>("riders", order.riderId, { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count });
  return ok(rec, 201);
});
