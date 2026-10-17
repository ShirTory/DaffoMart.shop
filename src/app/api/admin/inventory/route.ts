import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { handle, ok, readJson } from "@/server/http";
import { adjustStock } from "@/server/services";
import { inventorySchema } from "@/lib/validators";
import type { StockLog } from "@/lib/types";
export const dynamic = "force-dynamic";

/** GET: latest stock movements. POST {productId, mode: add|remove|set, qty, reason}: change stock and log it. */
export const GET = handle(async () => {
  await requireAdmin();
  const logs = (await db.list<StockLog>("stocklogs")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60);
  return ok(logs);
});
export const POST = handle(async (req) => {
  await requireAdmin();
  const d = inventorySchema.parse(await readJson(req));
  return ok(await adjustStock(d.productId, d.mode, d.qty, d.reason));
});
