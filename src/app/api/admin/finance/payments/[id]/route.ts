import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { reversePayment } from "@/server/accounting";

/** POST = reverse (the record is kept with who/when/why; payments are never deleted). */
export const POST = handle(async (req, ctx) => {
  const admin = await requireFinance();
  const { id } = await ctx.params;
  const { reason } = z.object({ reason: z.string().trim().min(3).max(200) }).parse(await readJson(req));
  const rec = await reversePayment(id, reason, admin.email);
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "payment.reverse", target: id, detail: `৳${rec.amount} ${rec.kind}: ${reason}` });
  return ok(rec);
});
