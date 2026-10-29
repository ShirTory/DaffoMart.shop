import { requireFinance } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
import { createSupplier, supplierDues } from "@/server/accounting";

export const GET = handle(async () => { await requireFinance(); return ok(await supplierDues()); });
export const POST = handle(async (req) => {
  const admin = await requireFinance();
  const b = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().max(30).optional(), address: z.string().max(200).optional(), note: z.string().max(300).optional() }).parse(await readJson(req));
  const rec = await createSupplier(b);
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "supplier.create", target: rec.id, detail: rec.name });
  return ok(rec, 201);
});
