import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { createPurchase, inventoryValuation, receivePurchase, recordPayment, supplierDues } from "@/server/accounting";

export const GET = handle(async () => { await requireFinance(); const [d, v] = await Promise.all([supplierDues(), inventoryValuation()]); return ok({ ...d, valuation: v }); });

const schema = z.object({
  supplierId: z.string().min(1).max(60), invoiceNo: z.string().trim().max(60).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(z.object({ productId: z.string().max(60).optional(), variantId: z.string().max(40).optional(), name: z.string().trim().max(120).optional(), qty: z.coerce.number(), unitCost: z.coerce.number().min(0) })).min(1).max(100),
  note: z.string().max(300).optional(), receive: z.boolean().default(true),
  paidNow: z.coerce.number().min(0).default(0), method: z.string().trim().max(30).default("cash"), reference: z.string().trim().max(80).default(""),
});

export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const b = schema.parse(await readJson(req));
  const p = await createPurchase({ ...b, by: admin.email });
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "purchase.create", target: p.id, detail: `${p.supplierName} ${p.invoiceNo} ৳${p.total}` });
  let received = false;
  if (b.receive) { received = !(await receivePurchase(p.id)).already; }
  if (b.paidNow > 0) await recordPayment({ kind: "supplier", refId: p.id, amount: b.paidNow, date: b.date, method: b.method, reference: b.reference, note: "Paid with the purchase", idempotencyKey: `paid-now-${p.id}`, by: admin.email });
  return ok({ ...p, received }, 201);
});
