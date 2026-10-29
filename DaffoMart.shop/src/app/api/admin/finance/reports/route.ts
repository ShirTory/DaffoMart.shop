import { requireFinance } from "@/server/auth";
import { buildIncomeRows, listExpenses, parseRange } from "@/server/finance";
import { profitLossFull } from "@/server/accounting";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requireFinance();
  const url = new URL(req.url);
  const { from, to } = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const type = url.searchParams.get("type") || "sales";
  if (type === "expenses") {
    const rows = await listExpenses(from, to);
    const byCat: Record<string, number> = {};
    for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + r.amount;
    return ok({ type, from, to, rows, byCategory: byCat, total: rows.reduce((n, r) => n + r.amount, 0) });
  }
  if (type === "pnl") return ok({ type, ...(await profitLossFull(from, to)) });
  const rows = await buildIncomeRows(from, to);
  const byPay: Record<string, number> = {};
  for (const r of rows) byPay[r.paymentMethod] = (byPay[r.paymentMethod] || 0) + r.amount;
  return ok({ type: "sales", from, to, rows, byPayment: byPay, total: rows.reduce((n, r) => n + r.amount, 0) });
});
