import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { handle, ok, readJson } from "@/server/http";
import { moderate, removeReview } from "@/server/reviews";
import { logAudit } from "@/server/audit";
export const dynamic = "force-dynamic";
const body = z.object({ status: z.enum(["pending", "approved", "rejected", "hidden"]), note: z.string().trim().max(300).optional() });
export const PATCH = handle(async (req, ctx) => {
  const a = await requireAdmin(); const { id } = await ctx.params; const b = body.parse(await readJson(req));
  const r = await moderate(id, b.status, a.email, b.note);
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "review.moderate", target: id, detail: b.status });
  return ok({ id: r.id, status: r.status });
});
export const DELETE = handle(async (_r, ctx) => { const a = await requireAdmin(); const { id } = await ctx.params; await removeReview(id); await logAudit({ actor: a.email, actorRole: a.adminRole, action: "review.delete", target: id }); return ok({ id }); });
