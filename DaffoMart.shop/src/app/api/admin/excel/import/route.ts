import { requireAdmin } from "@/server/auth";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import { logAudit } from "@/server/audit";
import { importDataset, IMPORTABLE, type Dataset } from "@/server/excel";
import { XLSX_LIMITS } from "@/server/xlsx";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";

/** POST multipart: file=<.xlsx>, dataset=products|inventory|customers, commit=0|1 (0 = preview only, changes nothing), mode=upsert|skip_existing */
export const POST = handle(async (req) => {
  const a = await requireAdmin(); rateLimit(`xl-import:${a.email}`, 20, 10 * 60_000);
  const form = await req.formData().catch(() => { throw new ApiError(400, "Send the workbook as multipart/form-data"); });
  const ds = String(form.get("dataset") ?? "") as Dataset; if (!IMPORTABLE.includes(ds)) throw new ApiError(400, "Choose products, inventory or customers");
  const file = form.get("file"); if (!(file instanceof File)) throw new ApiError(400, "No file received");
  if (!/\.xlsx$/i.test(file.name)) throw new ApiError(400, "Please upload an Excel .xlsx file (not .xls or .csv)");
  if (file.size > XLSX_LIMITS.maxFileBytes) throw new ApiError(413, "File is too large (max 5 MB)");
  const commit = String(form.get("commit") ?? "0") === "1"; const mode = form.get("mode") === "skip_existing" ? "skip_existing" : "upsert";
  const report = await importDataset(ds, Buffer.from(await file.arrayBuffer()), { commit, mode });
  if (commit) await logAudit({ actor: a.email, actorRole: a.adminRole, action: "excel.import", target: ds, detail: `${report.created} created, ${report.updated} updated, ${report.errors.length} rejected rows (${file.name.slice(0, 60)})`, ip: clientIp(req) });
  return ok(report);
});
