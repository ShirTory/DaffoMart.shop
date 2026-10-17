import { db } from "@/server/db";
import { normPhone } from "@/lib/format";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Public: recent orders for a phone number (last 20). */
export const GET = handle(async (req) => {
  rateLimit(`myorders:${clientIp(req)}`, 15, 10 * 60_000);
  const phone = normPhone((new URL(req.url).searchParams.get("phone") ?? "").trim());
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new ApiError(400, "Enter a valid mobile number (01XXXXXXXXX)");
  const list = (await db.list<Order>("orders"))
    .filter((o) => o.phone === phone)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((o) => ({
      orderNo: o.orderNo,
      status: o.status,
      createdAt: o.createdAt,
      total: o.total,
      itemCount: o.items.reduce((n, i) => n + i.qty, 0),
      items: o.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, unit: i.unit, image: i.image, emoji: i.emoji })),
      riderName: o.riderName,
      payment: o.payment,
      paymentStatus: o.paymentStatus,
    }));
  return ok(list);
});
