import type { MetadataRoute } from "next";
import { getActiveProducts, getCategories, getSettings } from "@/server/queries";
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
  try {
    const [products, categories, settings] = await Promise.all([getActiveProducts(), getCategories(), getSettings()]);
    const med = settings.showMedicine;
    const out: MetadataRoute.Sitemap = [...base];
    if (med) out.push({ url: `${SITE_URL}/medicine`, lastModified: now, changeFrequency: "daily", priority: 0.9 });
    for (const c of categories) {
      if (c.kind === "medicine" && !med) continue;
      out.push({ url: `${SITE_URL}/${c.kind === "medicine" ? "medicine" : "products"}?cat=${encodeURIComponent(c.id)}`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    }
    for (const p of products) out.push({ url: `${SITE_URL}/products/${p.slug}`, lastModified: p.updatedAt ? new Date(p.updatedAt) : now, changeFrequency: "weekly", priority: 0.7 });
    return out;
  } catch { return base; } // database unreachable: still serve the static pages
}
