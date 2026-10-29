import { claimSku } from "@/server/resources";
import { requireFullAdmin } from "@/server/auth";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
import type { Product } from "@/lib/types";
import { z } from "zod";
export const dynamic = "force-dynamic";

/** Preview or apply unique SKUs for active products missing SKU. Never overwrites existing SKUs. */
export const POST = handle(async (req) => {
  const admin = await requireFullAdmin();
  let body: { apply: boolean; prefix: string };
  try {
    body = z.object({ apply: z.boolean().default(false), prefix: z.string().trim().max(12).default("DM") }).parse(await readJson(req));
  } catch {
    body = { apply: false, prefix: "DM" };
  }
  const products = await db.list<Product>("products");
  const used = new Set(products.filter((p) => p.sku).map((p) => p.sku!.toUpperCase()));
  const missing = products.filter((p) => p.active && !p.sku);
  const plan: { id: string; name: string; sku: string }[] = [];
  for (const p of missing) {
    const base = `${body.prefix}-${(p.slug || p.name).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24).toUpperCase()}` || `${body.prefix}-ITEM`;
    let sku = base, n = 2;
    while (used.has(sku)) sku = `${base}-${n++}`;
    used.add(sku);
    plan.push({ id: p.id, name: p.name, sku });
  }
  if (!body.apply) return ok({ apply: false, count: plan.length, plan });
  for (const row of plan) {
    const p = products.find((x) => x.id === row.id);
    if (!p || p.sku) continue;
    await claimSku(row.sku, p.id); // atomic reservation, same unique key the product form uses
    await db.put("products", { ...p, sku: row.sku, updatedAt: new Date().toISOString() });
  }
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "sku.backfill", detail: `applied ${plan.length} SKUs prefix=${body.prefix}` });
  return ok({ apply: true, count: plan.length, plan });
});
