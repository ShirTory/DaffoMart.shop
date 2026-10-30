import { requireFinance } from "@/server/auth";
import { parseRange } from "@/server/finance";
import { profitAnalytics } from "@/server/analytics";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requireFinance();
  const u = new URL(req.url); const { from, to } = parseRange(u.searchParams.get("from"), u.searchParams.get("to"));
  return ok(await profitAnalytics(from, to));
});
