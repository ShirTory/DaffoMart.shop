import { layoutFor, type LayoutDoc } from "./productPage";
import { listPublic } from "./reviews";
import { pickProducts, type PageLayout } from "@/lib/productPage";
import type { ProductPageData } from "@/components/product/ProductPage";
import type { Category, Product } from "@/lib/types";

/**
 * Everything the product page needs, resolved on the server.
 * `layoutOverride` lets the builder preview an unsaved / unpublished layout through the very same code path.
 */
export async function buildProductPageData(p: Product, all: Product[], categories: Category[], docs: LayoutDoc[], opts: { layoutOverride?: PageLayout; whatsapp?: string; preview?: boolean } = {}): Promise<ProductPageData & { source: string }> {
  const { layout, source } = opts.layoutOverride ? { layout: opts.layoutOverride, source: "preview" } : layoutFor(p.id, docs);
  const byId = new Map(all.map((x) => [x.id, x]));
  const lim = (id: "sameCategory" | "recommended") => layout.sections.find((s) => s.id === id)?.limit ?? 5;
  // same category: the admin's hand-picked list; with none picked, the first products of the category (so older products still get a section)
  const picked = pickProducts(p.sameCategoryIds, byId, new Set([p.id]), lim("sameCategory"));
  const sameCategory = picked.length || p.sameCategoryIds?.length ? picked : all.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, lim("sameCategory"));
  const shown = new Set([p.id, ...sameCategory.map((x) => x.id)]);
  const recommended = pickProducts(p.recommendedIds, byId, shown, lim("recommended"));
  const reviews = await listPublic(p.id, 0, 5);
  const cat = categories.find((c) => c.id === p.categoryId);
  return { product: p, categoryName: cat?.name, categoryId: cat?.id, layout, source, sameCategory, recommended, reviews, whatsapp: opts.whatsapp, preview: opts.preview };
}
