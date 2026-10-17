import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { createOrder } from "@/server/services";
import { orderCreateSchema } from "@/lib/validators";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Admin: GET /api/orders?status=&q= */
export const GET = handle(async (req) => {
  await requireAdmin();
  const u = new URL(req.url).searchParams; const status = u.get("status"), q = (u.get("q") ?? "").toLowerCase().trim();
  let list = await db.list<Order>("orders");
  if (status) list = list.filter((o) => o.status === status);
  if (q) list = list.filter((o) => o.orderNo.toLowerCase().includes(q) || o.name.toLowerCase().includes(q) || o.phone.includes(q));
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok(list);
});

/** Public checkout. Prices, stock, delivery and coupon are all re-computed on the server. */
export const POST = handle(async (req) => {
  rateLimit(`order:${clientIp(req)}`, 10, 10 * 60_000);
  const input = orderCreateSchema.parse(await readJson(req));
  const o = await createOrder(input);
  return ok({ orderNo: o.orderNo, total: o.total, id: o.id }, 201);
});
