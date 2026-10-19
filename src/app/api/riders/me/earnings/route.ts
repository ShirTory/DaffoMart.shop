import { requireRider } from "@/server/riderAuth";
import { riderStatement } from "@/server/accounting";
import { parseRange } from "@/server/finance";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";

/** A rider sees ONLY their own earnings and payments (identity comes from the session, never from the URL). */
export const GET = handle(async (req) => {
  const rider = await requireRider();
  const u = new URL(req.url);
  const { from, to } = parseRange(u.searchParams.get("from"), u.searchParams.get("to"));
  const s = await riderStatement(rider.id, from, to);
  return ok({ ...s, rows: s.rows.map(({ orderId: _o, ...r }) => r) });
});
