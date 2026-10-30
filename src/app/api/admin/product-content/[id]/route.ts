import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { saveProductContent } from "@/server/productContent";
import { productContentSchema } from "@/lib/validators";
import { logAudit } from "@/server/audit";
import type { Product } from "@/lib/types";
export const dynamic = "force-dynamic";
const pick = (p: Product) => ({ id: p.id, name: p.name, categoryId: p.categoryId, brand: p.brand, countryOfOrigin: p.countryOfOrigin, manufacturer: p.manufacturer, manufacturerInfo: p.manufacturerInfo, description: p.description, descSections: p.descSections ?? [], specs: p.specs ?? [], video: p.video ?? null, extraImages: p.extraImages ?? [], badges: p.badges ?? [], sameCategoryIds: p.sameCategoryIds ?? [], recommendedIds: p.recommendedIds ?? [], reviewCount: p.reviewCount ?? 0, rating: p.rating });
export const GET = handle(async (_r, ctx) => { await requireAdmin(); const { id } = await ctx.params; const p = await db.get<Product>("products", id); if (!p) throw new ApiError(404, "Product not found"); return ok(pick(p)); });
export const PUT = handle(async (req, ctx) => {
  const a = await requireAdmin(); const { id } = await ctx.params;
  const p = await saveProductContent(id, productContentSchema.parse(await readJson(req)));
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "product.content", target: id });
  return ok(pick(p));
});
