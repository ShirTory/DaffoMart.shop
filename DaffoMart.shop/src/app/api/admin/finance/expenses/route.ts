import { requireFinance } from "@/server/auth";
import { createExpense, listExpenses } from "@/server/finance";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";

const schema = z.object({
  category: z.string().trim().min(1).max(60),
  amount: z.coerce.number().positive().max(1e9),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.string().trim().max(40).default("cash"),
  note: z.string().trim().max(400).default(""),
  receiptUrl: z.string().max(1000).optional(),
  orderId: z.string().trim().max(40).optional(),
});

export const GET = handle(async (req) => {
  await requireFinance();
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const payment = url.searchParams.get("payment") || undefined;
  let rows = await listExpenses(from, to);
  if (category) rows = rows.filter((r) => r.category.toLowerCase().includes(category.toLowerCase()));
  if (payment) rows = rows.filter((r) => r.paymentMethod.toLowerCase().includes(payment.toLowerCase()));
  return ok(rows);
});

export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const body = schema.parse(await readJson(req));
  const rec = await createExpense({ ...body, createdBy: admin.email });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.expense.create", target: rec.id, detail: `৳${rec.amount} ${rec.category}` });
  return ok(rec, 201);
});
