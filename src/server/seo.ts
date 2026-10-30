import { db } from "./db";
import { ApiError } from "./http";
import { safeCanonical } from "@/lib/seo";
import type { Category, Product, SeoEntry } from "@/lib/types";

export const STATIC_KEYS = ["home", "products", "offers", "contact", "policy", "medicine"] as const;
const KEY = /^(home|products|offers|contact|policy|medicine|category:[A-Za-z0-9_-]{1,60}|product:[A-Za-z0-9_-]{1,60})$/;
export const isSeoKey = (k: string) => KEY.test(k);

export interface SeoInput { title?: string; description?: string; keywords?: string; image?: string; canonical?: string; noindex?: boolean }
const clean = (v: unknown, max: number, label: string) => {
  if (v === undefined || v === null) return undefined;
  const t = String(v).replace(/\s+/g, " ").trim(); if (!t) return undefined;
  if (t.length > max) throw new ApiError(400, `${label} must be at most ${max} characters`);
  return t;
};
/** Pure: validate and tidy one SEO form. Empty fields are dropped so the automatic value is used. */
export function normalizeSeo(key: string, i: SeoInput, by: string, nowIso: string): SeoEntry {
  if (!isSeoKey(key)) throw new ApiError(400, "Unknown page");
  const title = clean(i.title, 70, "Title"), description = clean(i.description, 200, "Description");
  const kw = clean(i.keywords, 250, "Keywords");
  const keywords = kw ? kw.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 20).join(", ") : undefined;
  const image = clean(i.image, 400, "Image");
  if (image && !(/^https:\/\//i.test(image) || (image.startsWith("/") && !image.startsWith("//")))) throw new ApiError(400, "Use an uploaded image or an https:// image link");
  const canonicalRaw = clean(i.canonical, 300, "Canonical URL");
  const canonical = canonicalRaw ? safeCanonical(canonicalRaw) : undefined;
  if (canonicalRaw && !canonical) throw new ApiError(400, "The canonical URL must be a path on this site (like /products/rice) or a full link on this site's own address.");
  return { id: key, ...(title ? { title } : {}), ...(description ? { description } : {}), ...(keywords ? { keywords } : {}), ...(image ? { image } : {}), ...(canonical ? { canonical } : {}), ...(i.noindex === true ? { noindex: true } : {}), updatedAt: nowIso, updatedBy: by };
}

export async function listSeo() { return (await db.list<SeoEntry>("seo_overrides")).sort((a, b) => a.id.localeCompare(b.id)); }
export async function saveSeo(key: string, input: SeoInput, by: string) {
  if (key.startsWith("category:") && !(await db.get<Category>("categories", key.slice(9)))) throw new ApiError(404, "Category not found");
  if (key.startsWith("product:") && !(await db.get<Product>("products", key.slice(8)))) throw new ApiError(404, "Product not found");
  const e = normalizeSeo(key, input, by, new Date().toISOString());
  const empty = !e.title && !e.description && !e.keywords && !e.image && !e.canonical && !e.noindex;
  if (empty) { if (await db.get("seo_overrides", key)) await db.remove("seo_overrides", key); return null; } // nothing customised: back to automatic
  await db.put("seo_overrides", e); return e;
}
export async function resetSeo(key: string) { if (!isSeoKey(key)) throw new ApiError(400, "Unknown page"); if (await db.get("seo_overrides", key)) await db.remove("seo_overrides", key); }
