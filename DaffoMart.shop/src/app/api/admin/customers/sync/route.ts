import { requireAdmin } from "@/server/auth";
import { clientIp, handle, ok } from "@/server/http";
import { logAudit } from "@/server/audit";
import { syncCustomersFromOrders } from "@/server/customers";
export const dynamic = "force-dynamic";
/** Builds customer records from all existing orders (safe to run repeatedly: no duplicates are created). */
export const POST = handle(async (req) => {
  const a = await requireAdmin(); const r = await syncCustomersFromOrders();
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "customer.sync", detail: `${r.created} created, ${r.updated} refreshed`, ip: clientIp(req) });
  return ok(r);
});
