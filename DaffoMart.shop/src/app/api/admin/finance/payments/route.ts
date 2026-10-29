import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { listPayments, recordPayment } from "@/server/accounting";

const schema = z.object({
  kind: z.enum(["salary", "rider", "supplier", "receivable"]), refId: z.string().min(1).max(80),
  amount: z.coerce.number().positive().max(1e9), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().trim().max(30).default("cash"), reference: z.string().trim().max(80).default(""), note: z.string().trim().max(300).default(""),
  idempotencyKey: z.string().trim().max(80).optional(),
});

export const GET = handle(async (req) => {
  await requireFinance();
  const u = new URL(req.url);
  return ok(await listPayments({ kind: u.searchParams.get("kind") || undefined, refId: u.searchParams.get("refId") || undefined, from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined, includeReversed: u.searchParams.get("all") === "1" }));
});

export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const body = schema.parse(await readJson(req));
  const r = await recordPayment({ ...body, by: admin.email });
  if (!r.duplicate) await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: `payment.${body.kind}`, target: r.payment!.id, detail: `৳${body.amount} ref=${body.refId} ${body.method}` });
  return ok(r, r.duplicate ? 200 : 201);
});
