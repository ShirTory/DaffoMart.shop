import { requireFinance } from "@/server/auth";
import { buildIncomeRows, createIncome, isRealDate } from "@/server/finance";
import { ApiError } from "@/server/http";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";

const manualSchema = z.object({
  category: z.string().trim().min(1).max(60).default("Other Income"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1e9),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate, "Not a real calendar date"),
  paymentMethod: z.string().trim().max(40).default("cash"),
  note: z.string().trim().max(400).default(""),
  orderId: z.string().trim().max(40).optional(),
});

export const GET = handle(async (req) => {
  await requireFinance();
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  if ((from && !isRealDate(from)) || (to && !isRealDate(to))) throw new ApiError(400, "Dates must be real calendar dates in YYYY-MM-DD format");
  const payment = url.searchParams.get("payment") || undefined;
  const category = url.searchParams.get("category") || undefined;
  let rows = await buildIncomeRows(from, to);
  if (payment) rows = rows.filter((r) => r.paymentMethod.toLowerCase().includes(payment.toLowerCase()));
  if (category) rows = rows.filter((r) => r.category.toLowerCase().includes(category.toLowerCase()));
  return ok(rows);
});

export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const body = manualSchema.parse(await readJson(req));
  const rec = await createIncome({ ...body, createdBy: admin.email });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.income.create", target: rec.id, detail: `৳${rec.amount} ${rec.category}` });
  return ok(rec, 201);
});
