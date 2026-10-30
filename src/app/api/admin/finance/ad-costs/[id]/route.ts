import { requireFinance } from "@/server/auth";
import { deleteAdCost } from "@/server/analytics";
import { logAudit } from "@/server/audit";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const DELETE = handle(async (_r, ctx) => { const a = await requireFinance(); const { id } = await ctx.params; await deleteAdCost(id); await logAudit({ actor: a.email, actorRole: a.adminRole, action: "finance.adcost.delete", target: id }); return ok({ id }); });
