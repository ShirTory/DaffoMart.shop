import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { handle, ok, readJson } from "@/server/http";
import type { Category } from "@/lib/types";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ ids: z.array(z.string().min(1).max(60)).min(1).max(500) });

/**
 * POST {ids}: the admin's chosen category order, first = shown first on the storefront (home strip, menus, medicine page).
 * Sort numbers are rewritten as 1..n. Categories not listed keep their relative order after the listed ones; unknown ids are ignored.
 */
export const POST = handle(async (req) => {
  await requireAdmin();
  const { ids } = bodySchema.parse(await readJson(req));
  const all = (await db.list<Category>("categories")).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const known = new Set(all.map((c) => c.id));
  const first = [...new Set<string>(ids)].filter((id) => known.has(id));
  const order = [...first, ...all.map((c) => c.id).filter((id) => !first.includes(id))];
  const byId = new Map(all.map((c) => [c.id, c]));
  for (const [i, id] of order.entries()) {
    if (byId.get(id)!.sortOrder !== i + 1) await db.update<Category>("categories", id, { sortOrder: i + 1 });
  }
  return ok(order.map((id, i) => ({ ...byId.get(id)!, sortOrder: i + 1 })));
});
