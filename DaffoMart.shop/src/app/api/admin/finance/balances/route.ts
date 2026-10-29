import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { accountBalances, inventoryValuation, payrollSummary, receivables, setOpeningBalance, supplierDues } from "@/server/accounting";
import { todayYmd } from "@/server/finance";

export const GET = handle(async () => {
  await requireFinance();
  const [accounts, rec, sup, val, pay] = await Promise.all([accountBalances(), receivables(), supplierDues(), inventoryValuation(), payrollSummary(todayYmd().slice(0, 7))]);
  return ok({ accounts, receivables: rec, payables: { suppliers: sup.totalPayable, salaryThisMonth: pay.totalOutstanding }, valuation: val });
});

export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const b = z.object({ method: z.string().trim().min(1).max(30), label: z.string().max(40).optional(), openingBalance: z.coerce.number(), openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(await readJson(req));
  const rec = await setOpeningBalance({ ...b, by: admin.email });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.opening-balance", target: rec.id, detail: `৳${rec.openingBalance} on ${rec.openingDate}` });
  return ok(rec);
});
