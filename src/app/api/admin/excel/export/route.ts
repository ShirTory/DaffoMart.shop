import { requireAdmin, requireFinance } from "@/server/auth";
import { ApiError, clientIp, handle, rateLimit } from "@/server/http";
import { logAudit } from "@/server/audit";
import { DATASETS, exportDataset, type Dataset } from "@/server/excel";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/admin/excel/export?dataset=products|inventory|orders|customers|reports[&template=1&from=&to=&status=]
 *  Reports (revenue figures) need Finance access; every other dataset needs full Admin Panel access. */
export const GET = handle(async (req) => {
  const u = new URL(req.url).searchParams; const ds = u.get("dataset") as Dataset;
  if (!DATASETS.includes(ds)) throw new ApiError(400, "Unknown dataset");
  const a = ds === "reports" ? await requireFinance() : await requireAdmin();
  rateLimit(`xl-export:${a.email}`, 30, 10 * 60_000);
  const from = u.get("from") || undefined, to = u.get("to") || undefined;
  if ((from && !ISO.test(from)) || (to && !ISO.test(to))) throw new ApiError(400, "Dates must look like 2026-10-31");
  const template = u.get("template") === "1";
  const { filename, buffer } = await exportDataset(ds, { template, from, to, status: u.get("status") || undefined });
  if (!template) await logAudit({ actor: a.email, actorRole: a.adminRole, action: "excel.export", target: ds, ip: clientIp(req) });
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
});
