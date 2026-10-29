import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { clientIp, handle, ok, readJson } from "@/server/http";
import { logAudit } from "@/server/audit";
import { createCustomer, filterCustomers, present } from "@/server/customers";
import type { Customer } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Admin: GET /api/admin/customers?q=&segment=&status=&area= — list + summary. Full Admin Panel access only (never Accountant / diagnostics-only IT). */
export const GET = handle(async (req) => {
  await requireAdmin();
  const u = new URL(req.url).searchParams; const all = await db.list<Customer>("customers");
  const items = filterCustomers(all, { q: u.get("q") ?? "", segment: u.get("segment") ?? "", status: u.get("status") ?? "", area: u.get("area") ?? "" });
  const seg: Record<string, number> = { new: 0, regular: 0, vip: 0, inactive: 0 }; for (const c of all) seg[present(c).segment]++;
  const areas = [...new Set(all.map((c) => c.area).filter(Boolean) as string[])].sort();
  return ok({ items: items.slice(0, 1000), total: all.length, matched: items.length, segments: seg, areas, spent: all.reduce((n, c) => n + c.totalSpent, 0) });
});

export const POST = handle(async (req) => {
  const a = await requireAdmin();
  const c = await createCustomer((await readJson(req)) ?? {}, "manual");
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "customer.create", target: c.id, ip: clientIp(req) });
  return ok(present(c), 201);
});
