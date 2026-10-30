import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductView from "@/components/product/ProductPage";
import { buildProductPageData } from "@/server/productPageData";
import { hasVariants, priceRange } from "@/lib/variants";
import { getActiveProducts, getCategories, getLayoutDocs, getSeoMap, getSettings } from "@/server/queries";
import { pageMeta, seoKeys, withSeo } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
export const revalidate = 60; // served from cache, refreshed when the admin saves (and at most every 60 s)

const find = async (slug: string) => (await getActiveProducts()).find((p) => p.slug === slug);
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [p, seo] = [await find((await params).slug), await getSeoMap()];
  if (!p) return { title: "Product not found", robots: { index: false } };
  return pageMeta(withSeo({ title: p.name, description: (p.description || `${p.name} – ${p.unit}`).replace(/\s+/g, " ").slice(0, 160), path: `/products/${p.slug}`, image: p.image }, seo[seoKeys.product(p.id)]));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [all, categories, docs, settings] = [await getActiveProducts(), await getCategories(), await getLayoutDocs(), await getSettings()];
  const { slug } = await params;
  const p = all.find((x) => x.slug === slug); if (!p) notFound();
  const data = await buildProductPageData(p, all, categories, docs, { whatsapp: settings.whatsapp });
  const images = p.images?.length ? p.images : p.image ? [p.image] : [];
  const vr = hasVariants(p);
  const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u}`);
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, ...(p.description ? { description: p.description } : {}),
    ...(images.length ? { image: images.map(abs) } : {}), ...(p.brand || p.manufacturer ? { brand: { "@type": "Brand", name: p.brand || p.manufacturer } } : {}),
    ...(p.sku ? { sku: p.sku } : {}), ...(p.countryOfOrigin ? { countryOfOrigin: p.countryOfOrigin } : {}),
    ...(data.reviews.stats.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: data.reviews.stats.average, reviewCount: data.reviews.stats.count } } : {}),
    ...(data.reviews.items.length ? { review: data.reviews.items.map((r) => ({ "@type": "Review", author: { "@type": "Person", name: r.name }, datePublished: r.createdAt.slice(0, 10), reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 }, reviewBody: r.text })) } : {}),
    offers: vr
      ? { "@type": "AggregateOffer", url: `${SITE_URL}/products/${p.slug}`, priceCurrency: "BDT", lowPrice: priceRange(p.variants!).min, highPrice: priceRange(p.variants!).max, offerCount: p.variants!.length, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
      : { "@type": "Offer", url: `${SITE_URL}/products/${p.slug}`, priceCurrency: "BDT", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  const cat = categories.find((c) => c.id === p.categoryId);
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ name: "Home", url: `${SITE_URL}/` }, ...(cat ? [{ name: cat.name, url: `${SITE_URL}/products?cat=${cat.id}` }] : []), { name: p.name, url: `${SITE_URL}/products/${p.slug}` }].map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, item: x.url })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <ProductView data={data} />
    </>
  );
}
