import type { MetadataRoute } from "next";
import { getActiveProducts, getCategories, getSeoMap, getSettings } from "@/server/queries";
import { seoKeys } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
export const dynamic = "force-dynamic"; // reads the live catalogue (not evaluated at build time)

/** Only public, indexable pages. Cart, checkout, order tracking, account, rider and admin pages are deliberately left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/policy`, changeFrequency: "yearly", priority: 0.3 },
  ];
  const keyOf = (u: string) => (u === `${SITE_URL}/` ? "home" : u === `${SITE_URL}/products` ? "products" : u === `${SITE_URL}/contact` ? "contact" : u === `${SITE_URL}/policy` ? "policy" : "");
  try {
    const [products, categories, settings, seo] = await Promise.all([getActiveProducts(), getCategories(), getSettings(), getSeoMap()]);
    const hidden = (key: string) => seo[key]?.noindex === true; // pages the admin set to "noindex" are left out of the sitemap
    const med = settings.showMedicine;
    const out: MetadataRoute.Sitemap = base.filter((b) => !hidden(keyOf(b.url)));
    if (!hidden("offers") && products.some((p) => p.oldPrice && p.oldPrice > p.price)) out.push({ url: `${SITE_URL}/products?sale=1`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    if (med && !hidden("medicine")) out.push({ url: `${SITE_URL}/medicine`, lastModified: now, changeFrequency: "daily", priority: 0.9 });
    for (const c of categories) {
      if ((c.kind === "medicine" && !med) || hidden(seoKeys.category(c.id))) continue;
      out.push({ url: `${SITE_URL}/${c.kind === "medicine" ? "medicine" : "products"}?cat=${encodeURIComponent(c.id)}`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    }
    for (const p of products) if (!hidden(seoKeys.product(p.id))) out.push({ url: `${SITE_URL}/products/${p.slug}`, lastModified: p.updatedAt ? new Date(p.updatedAt) : now, changeFrequency: "weekly", priority: 0.7 });
    return out;
  } catch { return base; } // database unreachable: still serve the static pages
}
