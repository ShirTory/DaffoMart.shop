import { db } from "@/server/db";
import { normPhone } from "@/lib/format";
import { ApiError, clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { setOrderStatus } from "@/server/services";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";

const CANCEL_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/** Public cancel: order number + phone, only while still pending and within 2 minutes of creation. */
export const POST = handle(async (req) => {
  rateLimit(`cancel:${clientIp(req)}`, 5, 10 * 60_000);
  const body = await readJson(req) as { no?: string; phone?: string };
  const no = (body.no ?? "").trim().toUpperCase();
  const phone = normPhone((body.phone ?? "").trim());
  if (!no || !phone) throw new ApiError(400, "Enter your order number and phone number");
  const o = (await db.list<Order>("orders")).find((x) => x.orderNo === no && x.phone === phone);
  if (!o) throw new ApiError(404, "No order found with these details");
  if (o.status !== "pending") throw new ApiError(400, "Only pending orders can be cancelled");
  const age = Date.now() - new Date(o.createdAt).getTime();
  if (age > CANCEL_WINDOW_MS) throw new ApiError(400, "Cancellation window has closed (available only within 2 minutes of placing the order)");
  const updated = await setOrderStatus(o.id, "cancelled");
  return ok({ orderNo: updated.orderNo, status: updated.status });
});
