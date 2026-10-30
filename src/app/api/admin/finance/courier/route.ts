import { requireFinance } from "@/server/auth";
import { parseRange } from "@/server/finance";
import { courierRows, doubleCountWarnings, summarize } from "@/server/courier";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
/** Parcel list + totals for a date range (parcel cost date), optionally for one courier. */
export const GET = handle(async (req) => {
  await requireFinance();
  const u = new URL(req.url);
  const { from, to } = parseRange(u.searchParams.get("from"), u.searchParams.get("to"));
  const rows = await courierRows(from, to, u.searchParams.get("courierId") || undefined);
  return ok({ rows, summary: summarize(rows), doubleCount: await doubleCountWarnings(rows) });
});
