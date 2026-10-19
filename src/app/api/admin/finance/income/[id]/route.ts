import { requireFinance } from "@/server/auth";
import { deleteIncome, updateIncome } from "@/server/finance";
import { logAudit } from "@/server/audit";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";

const schema = z.object({
  category: z.string().trim().min(1).max(60).optional(),
  amount: z.coerce.number().positive().max(1e9).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  note: z.string().trim().max(400).optional(),
  orderId: z.string().trim().max(40).optional().nullable(),
});

export const PUT = handle(async (req, ctx) => {
  const admin = await requireFinance();
  const { id } = await ctx.params;
  if (id.startsWith("order:")) throw new ApiError(400, "Order income is read-only — change the order status instead");
  const body = schema.parse(await readJson(req));
  const rec = await updateIncome(id, { ...body, orderId: body.orderId === null ? undefined : body.orderId });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.income.update", target: id });
  return ok(rec);
});

export const DELETE = handle(async (_req, ctx) => {
  const admin = await requireFinance();
  const { id } = await ctx.params;
  if (id.startsWith("order:")) throw new ApiError(400, "Order income cannot be deleted");
  await deleteIncome(id);
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.income.delete", target: id });
  return ok({ id });
});
