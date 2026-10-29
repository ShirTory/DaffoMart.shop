import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { dhakaDate } from "@/lib/dates";
import type { Attendance, DeliveryZone, Employee, Order, Product, Rider } from "@/lib/types";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireAdmin();
  const [orders, emps, att, zones, riders, products] = await Promise.all([db.list<Order>("orders"), db.list<Employee>("employees"), db.list<Attendance>("attendance"), db.list<DeliveryZone>("zones"), db.list<Rider>("riders"), db.list<Product>("products")]);
  const today = dhakaDate(), open = orders.filter((o) => !["delivered", "cancelled", "returned"].includes(o.status));
  const courierZones = new Set(zones.filter((z) => z.viaCourier).map((z) => z.id));
  const viaCourier = (o: Order) => Boolean(o.courierId) || courierZones.has(o.zone);
  const active = emps.filter((e) => e.active), todays = att.filter((a) => a.date === today);
  const count = (s: string) => todays.filter((a) => a.status === s).length;
  const marked = new Set(todays.map((a) => a.employeeId));
  return ok({
    today,
    staff: { total: active.length, present: count("present"), late: count("late"), half: count("half"), leave: count("leave"), absent: count("absent"), off: count("off"), notMarked: active.filter((e) => !marked.has(e.id)).length },
    orders: {
      pending: orders.filter((o) => o.status === "pending").length,
      needsRider: open.filter((o) => !viaCourier(o) && !o.riderId && ["confirmed", "processing"].includes(o.status)).length,
      needsCourier: open.filter((o) => viaCourier(o) && !o.courierId && o.status !== "pending").length,
      withCourier: open.filter((o) => o.courierId).length,
      onTheWay: orders.filter((o) => ["assigned", "picked_up", "on_the_way"].includes(o.status)).length,
      deliveredToday: orders.filter((o) => o.status === "delivered" && o.updatedAt.slice(0, 10) === today).length,
      unpaidOnline: orders.filter((o) => o.paymentStatus === "pending" && o.payment !== "cod" && o.payment !== "online").length,
    },
    ridersOnline: riders.filter((r) => r.locAt && Date.now() - new Date(r.locAt).getTime() < 900_000).length,
    lowStock: products.filter((p) => p.active && p.stock <= 5).length,
  });
});
