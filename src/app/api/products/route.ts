import { db } from "@/server/db";
import { getAdmin, requireAdmin } from "@/server/auth";
import { handle, ok, readJson } from "@/server/http";
import { newId } from "@/server/db";
import { productCfg } from "@/server/resources";
import { getActiveProducts } from "@/server/queries";
import type { Product } from "@/lib/types";
export const dynamic = "force-dynamic";

/** GET /api/products?ids=a,b&q=&cat=&sort=price_asc|price_desc|popular|newest&max=&min=&featured=1&sale=1&limit=&page= */
export const GET = handle(async (req) => {
  const u = new URL(req.url).searchParams; const admin = await getAdmin();
  let list = admin ? await db.list<Product>("products") : [...(await getActiveProducts())]; // public visitors get the cached list
  const ids = (u.get("ids") ?? "").split(",").filter(Boolean).slice(0, 100);
  if (ids.length) list = list.filter((p) => ids.includes(p.id));
  const q = (u.get("q") ?? "").toLowerCase().trim(), cat = u.get("cat"), max = Number(u.get("max")), min = Number(u.get("min"));
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  if (cat) list = list.filter((p) => p.categoryId === cat);
  if (max) list = list.filter((p) => p.price <= max);
  if (min) list = list.filter((p) => p.price >= min);
  if (u.get("featured")) list = list.filter((p) => p.featured);
  if (u.get("sale")) list = list.filter((p) => p.oldPrice && p.oldPrice > p.price);
  const sort = u.get("sort");
  const by: Record<string, (a: Product, b: Product) => number> = {
    price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price,
    popular: (a, b) => b.sold - a.sold, newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };
  list.sort(by[sort ?? "newest"] ?? by.newest);
  const total = list.length;
  const limit = Math.min(Math.max(Number(u.get("limit")) || 100, 1), 500), page = Math.max(Number(u.get("page")) || 1, 1);
  list = list.slice((page - 1) * limit, page * limit);
  return ok({ items: list, total, page, limit });
});

export const POST = handle(async (req) => {
  await requireAdmin();
  const data = productCfg.schema.parse(await readJson(req));
  const rec = { ...(await productCfg.prepare(data, null)), id: newId() } as Product;
  return ok(await db.put("products", rec), 201);
});
