import { requireFinance } from "@/server/auth";
import { parseRange } from "@/server/finance";
import { cashflowFull } from "@/server/accounting";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requireFinance();
  const url = new URL(req.url);
  const { from, to } = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  return ok(await cashflowFull(from, to));
});
