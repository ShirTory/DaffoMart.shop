import type { Metadata } from "next";
import { DEFAULT_OG, SITE_URL } from "./site";
import type { SeoEntry } from "./types";

/** A canonical address is accepted only when it is a path on this site or a full URL on this site's own origin. Anything else is ignored (never trust a typo to point Google elsewhere). */
export function safeCanonical(v?: string): string | undefined {
  const t = (v || "").trim(); if (!t) return undefined;
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  try { const u = new URL(t); if (u.origin === new URL(SITE_URL).origin) return u.pathname + u.search; } catch { /* not a URL */ }
  return undefined;
}
export const seoKeys = { product: (id: string) => `product:${id}`, category: (id: string) => `category:${id}` };

type Meta = { title: string; description?: string; path: string; image?: string; noindex?: boolean; keywords?: string; absoluteTitle?: boolean };
/** Applies the admin's SEO entry (if any) on top of the automatic values. Empty fields keep the automatic value. */
export function withSeo(base: Meta, e?: SeoEntry | null): Meta {
  if (!e) return base;
  return { ...base, title: e.title?.trim() || base.title, description: e.description?.trim() || base.description, image: e.image?.trim() || base.image, path: safeCanonical(e.canonical) || base.path, noindex: e.noindex === true ? true : base.noindex, keywords: e.keywords?.trim() || base.keywords };
}

/** Per-page metadata: canonical URL, Open Graph, Twitter card, optional keywords and noindex. `path` is the page's own address (e.g. "/products?cat=abc"). */
export function pageMeta(o: Meta): Metadata {
  const image = o.image || DEFAULT_OG;
  const kw = (o.keywords || "").split(",").map((k) => k.trim()).filter(Boolean).slice(0, 20);
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    ...(o.description ? { description: o.description } : {}),
    ...(kw.length ? { keywords: kw } : {}),
    alternates: { canonical: o.path },
    openGraph: { type: "website", title: o.title, ...(o.description ? { description: o.description } : {}), url: o.path, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title: o.title, ...(o.description ? { description: o.description } : {}), images: [image] },
    ...(o.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
