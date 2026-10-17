import { db } from "@/server/db";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { requireRider } from "@/server/riderAuth";
import { setOrderStatus } from "@/server/services";
import { riderStatusSchema } from "@/lib/validators";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";

const OPEN = new Set(["assigned", "picked_up", "on_the_way"]);
/** A rider may only move THEIR OWN open orders forward (picked up → on the way → delivered, or returned). */
export const PATCH = handle(async (req, ctx) => {
  const rider = await requireRider(); const id = (await ctx.params).id;
  const { status } = riderStatusSchema.parse(await readJson(req));
  const o = await db.get<Order>("orders", id);
  if (!o || o.riderId !== rider.id) throw new ApiError(404, "Order not found");
  if (!OPEN.has(o.status)) throw new ApiError(409, "This order can no longer be updated");
  return ok(await setOrderStatus(id, status));
});
