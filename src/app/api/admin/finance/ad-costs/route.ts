import { z } from "zod";
import { requireFinance } from "@/server/auth";
import { parseRange } from "@/server/finance";
import { listAdCosts, saveAdCosts } from "@/server/analytics";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
export const dynamic = "force-dynamic";
const row = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), platform: z.string().trim().min(1).max(40), campaign: z.string().trim().min(1).max(120), productId: z.string().trim().max(40).optional(),
  amountBdt: z.coerce.number().min(0).max(1e9).optional(), amountUsd: z.coerce.number().min(0).max(1e9).optional(), usdRate: z.coerce.number().min(0).max(10000).optional(),
  reportedOrders: z.coerce.number().int().min(0).max(1e7).optional(), status: z.enum(["actual", "estimated", "unverified"]).optional(), note: z.string().trim().max(300).optional(),
});
const clean = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== "" && v !== null && v !== undefined && !(typeof v === "number" && Number.isNaN(v))));
export const GET = handle(async (req) => {
  await requireFinance();
  const u = new URL(req.url); const { from, to } = parseRange(u.searchParams.get("from"), u.searchParams.get("to"));
  return ok(await listAdCosts(from, to));
});
/** Body: one entry or { rows: [...] } (CSV import). All-or-nothing: any invalid row means nothing is saved and every row error is returned. */
export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const body: any = await readJson(req);
  const list = z.array(row).max(1000).parse((Array.isArray(body?.rows) ? body.rows : [body]).map((r: Record<string, unknown>) => clean(r)));
  const res = await saveAdCosts(list, admin.email);
  if (res.saved) await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.adcost.save", detail: `${res.created} new, ${res.updated} updated` });
  return ok(res);
});
