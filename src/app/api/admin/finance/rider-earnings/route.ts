import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { addRiderAdjustment, allRiderEarnings, riderStatement, setRiderTerms } from "@/server/accounting";
import { parseRange } from "@/server/finance";

export const GET = handle(async (req) => {
  await requireFinance();
  const u = new URL(req.url);
  const { from, to } = parseRange(u.searchParams.get("from"), u.searchParams.get("to"));
  const rid = u.searchParams.get("riderId");
  return ok(rid ? await riderStatement(rid, from, to) : await allRiderEarnings(from, to));
});

const adjust = z.object({ action: z.literal("adjust"), riderId: z.string().min(1).max(60), amount: z.coerce.number(), reason: z.string().trim().min(3).max(200), date: z.string(), note: z.string().max(300).optional() });
const terms = z.object({ action: z.literal("terms"), riderId: z.string().min(1).max(60), from: z.string(), perDelivery: z.coerce.number().min(0), commissionPct: z.coerce.number().min(0).max(100) });

export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const body = z.discriminatedUnion("action", [adjust, terms]).parse(await readJson(req));
  if (body.action === "terms") {
    const t = await setRiderTerms(body.riderId, body);
    await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "rider.terms", target: body.riderId, detail: `from ${body.from}: ৳${body.perDelivery}/delivery + ${body.commissionPct}% of delivery charge` });
    return ok(t);
  }
  const rec = await addRiderAdjustment({ ...body, by: admin.email });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "rider.adjustment", target: rec.id, detail: `rider=${body.riderId} ৳${body.amount}: ${body.reason}` });
  return ok(rec, 201);
});
