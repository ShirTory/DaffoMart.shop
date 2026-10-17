import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { assignRider, setCourier, setOrderStatus, setPaymentStatus } from "@/server/services";
import { orderPatchSchema } from "@/lib/validators";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";

export const GET = handle(async (_r, ctx) => {
  await requireAdmin(); const o = await db.get<Order>("orders", (await ctx.params).id);
  if (!o) throw new ApiError(404, "Order not found"); return ok(o);
});
/** PATCH {status?, riderId?, courierId?, trackingNo?}: riderId / courierId "" removes them. */
export const PATCH = handle(async (req, ctx) => {
  await requireAdmin(); const id = (await ctx.params).id;
  const { status, riderId, paymentStatus, courierId, trackingNo } = orderPatchSchema.parse(await readJson(req));
  let o: Order | null = null;
  if (riderId !== undefined) o = await assignRider(id, riderId);
  if (courierId !== undefined || trackingNo !== undefined) o = await setCourier(id, courierId, trackingNo);
  if (status !== undefined) o = await setOrderStatus(id, status);
  if (paymentStatus !== undefined) o = await setPaymentStatus(id, paymentStatus);
  return ok(o);
});
export const DELETE = handle(async (_r, ctx) => {
  await requireAdmin(); const id = (await ctx.params).id;
  if (!(await db.get("orders", id))) throw new ApiError(404, "Order not found");
  await db.remove("orders", id); return ok({ id });
});
