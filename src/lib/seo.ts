import type { Metadata } from "next";
import { DEFAULT_OG } from "./site";

/** Per-page metadata: canonical URL, Open Graph and Twitter card. `path` is the page's own address (e.g. "/products?cat=abc"). */
export function pageMeta(o: { title: string; description?: string; path: string; image?: string; noindex?: boolean }): Metadata {
  const image = o.image || DEFAULT_OG;
  return {
    title: o.title,
    ...(o.description ? { description: o.description } : {}),
    alternates: { canonical: o.path },
    openGraph: { type: "website", title: o.title, ...(o.description ? { description: o.description } : {}), url: o.path, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title: o.title, ...(o.description ? { description: o.description } : {}), images: [image] },
    ...(o.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
