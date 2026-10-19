import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { receivePurchase } from "@/server/accounting";

export const POST = handle(async (_req, ctx) => {
  const admin = await requireFinance();
  const { id } = await ctx.params;
  const r = await receivePurchase(id);
  if (!r.already) await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "purchase.receive", target: id, detail: "stock added" });
  return ok(r);
});
