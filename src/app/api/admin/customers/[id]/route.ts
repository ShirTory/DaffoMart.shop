import { db } from "@/server/db";
import { requireAdmin, requireOwner } from "@/server/auth";
import { ApiError, clientIp, handle, ok, readJson } from "@/server/http";
import { logAudit } from "@/server/audit";
import { present, recomputeCustomerStats, sanitizeFollowUps, updateCustomer } from "@/server/customers";
import { normalizeBdPhone } from "@/lib/phone";
import type { Customer, Order } from "@/lib/types";
export const dynamic = "force-dynamic";
const idOf = async (ctx: { params: Promise<Record<string, string>> }) => { const id = normalizeBdPhone((await ctx.params).id); if (!id) throw new ApiError(400, "Invalid customer id"); return id; };

/** Customer detail with the full order history (by phone, so orders placed before the CRM existed are included). */
export const GET = handle(async (_r, ctx) => {
  await requireAdmin(); const id = await idOf(ctx);
  const c = await db.get<Customer>("customers", id); if (!c) throw new ApiError(404, "Customer not found");
  const orders = (await db.find<Order>("orders", "phone", id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => ({ id: o.id, orderNo: o.orderNo, status: o.status, total: o.total, createdAt: o.createdAt, items: o.items.map((i) => `${i.qty}× ${i.name}`).join(", "), payment: o.paymentLabel || o.payment }));
  return ok({ customer: present(c), orders });
});
export const PUT = handle(async (req, ctx) => {
  const a = await requireAdmin(); const id = await idOf(ctx); const body = (await readJson(req)) ?? {};
  if (Array.isArray(body.followUps)) { const prev = await db.get<Customer>("customers", id); const known = new Set((prev?.followUps ?? []).map((f) => f.id)); body.followUps = sanitizeFollowUps(body.followUps, a.email).map((f) => known.has(f.id) ? f : { ...f, by: a.email }); }
  const c = await updateCustomer(id, body);
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "customer.update", target: id, detail: Object.keys(body).join(",").slice(0, 200), ip: clientIp(req) });
  return ok(present((await recomputeCustomerStats(id)) ?? c));
});
/** Deleting a customer record never deletes their orders. Owner only. */
export const DELETE = handle(async (req, ctx) => {
  const a = await requireOwner(); const id = await idOf(ctx);
  if (!(await db.get("customers", id))) throw new ApiError(404, "Customer not found");
  await db.remove("customers", id); await logAudit({ actor: a.email, actorRole: a.adminRole, action: "customer.delete", target: id, ip: clientIp(req) });
  return ok({ id });
});
