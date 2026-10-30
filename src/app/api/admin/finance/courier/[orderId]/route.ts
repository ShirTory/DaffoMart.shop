import { z } from "zod";
import { requireFinance } from "@/server/auth";
import { parcelHistory, saveParcel } from "@/server/courier";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
export const dynamic = "force-dynamic";
const money = z.coerce.number().min(0).max(1e7);
const schema = z.object({
  codAmount: money.optional().nullable(), amountReceived: money.optional(), deliveryCharge: money.optional(), returnCharge: money.optional(),
  deliveryChargePaidBy: z.enum(["customer", "company"]).optional(), returnChargePaidBy: z.enum(["customer", "company"]).optional(), returnStatus: z.enum(["none", "in_transit", "returned"]).optional(),
  costDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(), settlementRef: z.string().trim().max(80).optional(), note: z.string().trim().max(400).optional(),
  verified: z.boolean().optional(), reason: z.string().trim().max(300).optional(),
});
export const GET = handle(async (_r, ctx) => { await requireFinance(); const { orderId } = await ctx.params; return ok(await parcelHistory(orderId)); });
export const PUT = handle(async (req, ctx) => {
  const admin = await requireFinance(); const { orderId } = await ctx.params;
  const body = schema.parse(await readJson(req));
  const row = await saveParcel(orderId, { ...body, codAmount: body.codAmount ?? undefined }, admin.email);
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "finance.courier.save", target: orderId, detail: `${body.verified === true ? "verified; " : body.verified === false ? "unverified; " : ""}${body.reason || ""}`.slice(0, 300) });
  return ok(row);
});
