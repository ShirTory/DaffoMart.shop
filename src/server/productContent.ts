import { db, newId } from "./db";
import { ApiError } from "./http";
import { playableVideo } from "@/lib/productPage";
import type { Product } from "@/lib/types";
import type { ProductContentInput } from "@/lib/validators";

/** Saves ONLY the presentation fields of a product. Price, stock, SKU, variants and everything the shop/checkout use are left untouched. */
export async function saveProductContent(id: string, input: ProductContentInput): Promise<Product> {
  const cur = await db.get<Product>("products", id);
  if (!cur) throw new ApiError(404, "Product not found");
  if (input.video) {
    if (!input.video.url) throw new ApiError(400, "Add a video link or upload a video, or remove the video.");
    if (!playableVideo({ ...input.video })) throw new ApiError(400, input.video.kind === "upload" ? "That is not one of your uploaded videos." : "Only YouTube, Vimeo or direct https .mp4 / .webm links are supported.");
  }
  const ids = [...input.sameCategoryIds, ...input.recommendedIds];
  if (new Set(ids).size !== ids.length) throw new ApiError(400, "A product can be in only one of the two recommendation lists, once.");
  if (ids.includes(id)) throw new ApiError(400, "A product cannot recommend itself.");
  if (ids.length) {
    const found = new Map((await Promise.all(ids.map((x) => db.get<Product>("products", x)))).filter(Boolean).map((p) => [p!.id, p!]));
    for (const x of input.sameCategoryIds) { const p = found.get(x); if (!p) throw new ApiError(400, "One of the same-category products no longer exists."); if (p.categoryId !== cur.categoryId) throw new ApiError(400, `"${p.name}" is not in this product's category. Put it in the "other category" list.`); }
    for (const x of input.recommendedIds) { const p = found.get(x); if (!p) throw new ApiError(400, "One of the recommended products no longer exists."); if (p.categoryId === cur.categoryId) throw new ApiError(400, `"${p.name}" is in the same category. Put it in the "same category" list.`); }
  }
  const row = <T extends { id?: string }>(r: T) => ({ ...r, id: r.id || newId() });
  const next = await db.mutate<Product>("products", id, (p) => {
    if (!p) return null;
    const n: Product = { ...p, updatedAt: new Date().toISOString() };
    const set = <K extends keyof Product>(k: K, v: Product[K] | undefined | null | "" | never[]) => { if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) delete n[k]; else n[k] = v as Product[K]; };
    set("brand", input.brand); set("countryOfOrigin", input.countryOfOrigin); set("manufacturer", input.manufacturer); set("manufacturerInfo", input.manufacturerInfo);
    set("descSections", input.descSections.filter((d) => d.body.trim()).map(row));
    set("specs", input.specs.filter((s) => s.label.trim() && s.value.trim()).map(row));
    set("video", input.video ?? undefined); set("extraImages", input.extraImages); set("badges", input.badges);
    set("sameCategoryIds", input.sameCategoryIds); set("recommendedIds", input.recommendedIds);
    return n;
  });
  if (!next) throw new ApiError(404, "Product not found");
  return next;
}
