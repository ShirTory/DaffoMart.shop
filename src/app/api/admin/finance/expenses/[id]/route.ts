import { requireFinance } from "@/server/auth";
import { deleteExpense, updateExpense } from "@/server/finance";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";

const schema = z.object({
  category: z.string().trim().min(1).max(60).optional(),
  amount: z.coerce.number().positive().max(1e9).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  note: z.string().trim().max(400).optional(),
  receiptUrl: z.string().max(1000).optional().nullable(),
  orderId: z.string().trim().max(40).optional().nullable(),
});

export const PUT = handle(async (req, ctx) => {
  const admin = await requireFinance();
  const { id } = await ctx.params;
  const body = schema.parse(await readJson(req));
  const rec = await updateExpense(id, {
    ...body,
    receiptUrl: body.receiptUrl === null ? undefined : body.receiptUrl,
    orderId: body.orderId === null ? undefined : body.orderId,
  });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.expense.update", target: id });
  return ok(rec);
});

export const DELETE = handle(async (_req, ctx) => {
  const admin = await requireFinance();
  const { id } = await ctx.params;
  await deleteExpense(id);
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.expense.delete", target: id });
  return ok({ id });
});
