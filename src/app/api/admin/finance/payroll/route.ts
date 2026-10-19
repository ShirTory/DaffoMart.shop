import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { payrollSummary, setSalary, staffStatement, upsertSalaryEntry } from "@/server/accounting";
import { parseRange, todayYmd } from "@/server/finance";

const entry = z.object({
  action: z.literal("entry"), employeeId: z.string().min(1).max(60), period: z.string().regex(/^\d{4}-\d{2}$/),
  base: z.union([z.coerce.number(), z.literal("")]).optional(),
  allowances: z.coerce.number().optional(), bonus: z.coerce.number().optional(), overtime: z.coerce.number().optional(),
  deductions: z.coerce.number().optional(), advances: z.coerce.number().optional(),
  date: z.string().optional(), note: z.string().max(300).optional(),
});
const term = z.object({ action: z.literal("salary-term"), employeeId: z.string().min(1).max(60), amount: z.coerce.number(), from: z.string() });

/** ?period=YYYY-MM -> monthly payroll summary. ?employeeId=..[&from=&to=] -> that person's statement. */
export const GET = handle(async (req) => {
  await requireFinance();
  const u = new URL(req.url);
  const emp = u.searchParams.get("employeeId");
  if (emp) { const r = u.searchParams.get("from") ? parseRange(u.searchParams.get("from"), u.searchParams.get("to")) : { from: undefined, to: undefined }; return ok(await staffStatement(emp, r.from, r.to)); }
  return ok(await payrollSummary(u.searchParams.get("period") || todayYmd().slice(0, 7)));
});

export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const body = z.discriminatedUnion("action", [entry, term]).parse(await readJson(req));
  if (body.action === "salary-term") {
    const hist = await setSalary(body.employeeId, body.amount, body.from);
    await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "payroll.salary-term", target: body.employeeId, detail: `৳${body.amount} from ${body.from}` });
    return ok(hist);
  }
  const { action: _a, ...rest } = body;
  const rec = await upsertSalaryEntry({ ...rest, by: admin.email });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: rec.revision > 1 ? "payroll.entry.update" : "payroll.entry.create", target: rec.id, detail: `${rec.period} net ৳${rec.amount} rev ${rec.revision}` });
  return ok(rec, rec.revision > 1 ? 200 : 201);
});
