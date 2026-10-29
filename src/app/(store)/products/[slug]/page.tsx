import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AddToCart from "@/components/store/AddToCart";
import Gallery from "@/components/store/Gallery";
import VariantBuyBox from "@/components/store/VariantBuyBox";
import { hasVariants, priceRange } from "@/lib/variants";
import ProductCard from "@/components/store/ProductCard";
import { getActiveProducts, getCategories } from "@/server/queries";
import { discountPct, taka } from "@/lib/format";
import { pageMeta } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
export const revalidate = 60; // served from cache, refreshed when the admin saves (and at most every 60 s)

const find = async (slug: string) => (await getActiveProducts()).find((p) => p.slug === slug);
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await find((await params).slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  return pageMeta({ title: p.name, description: (p.description || `${p.name} – ${p.unit}`).replace(/\s+/g, " ").slice(0, 160), path: `/products/${p.slug}`, image: p.image });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [all, categories] = [await getActiveProducts(), await getCategories()];
  const { slug } = await params;
  const p = all.find((x) => x.slug === slug); if (!p) notFound();
  const related = all.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 5);
  const cat = categories.find((c) => c.id === p.categoryId); const off = discountPct(p.price, p.oldPrice);
  const images = p.images?.length ? p.images : p.image ? [p.image] : [];
  const vr = hasVariants(p);
  const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u}`);
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, ...(p.description ? { description: p.description } : {}),
    ...(images.length ? { image: images.map(abs) } : {}), ...(p.manufacturer ? { brand: { "@type": "Brand", name: p.manufacturer } } : {}),
    offers: vr
      ? { "@type": "AggregateOffer", url: `${SITE_URL}/products/${p.slug}`, priceCurrency: "BDT", lowPrice: priceRange(p.variants!).min, highPrice: priceRange(p.variants!).max, offerCount: p.variants!.length, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
      : { "@type": "Offer", url: `${SITE_URL}/products/${p.slug}`, priceCurrency: "BDT", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <nav className="mb-4 text-sm text-gray-500"><Link href="/" className="hover:text-primary">Home</Link> / <Link href="/products" className="hover:text-primary">Products</Link>{cat && <> / <Link href={`/products?cat=${cat.id}`} className="hover:text-primary">{cat.name}</Link></>}</nav>
      <div className="grid gap-8 rounded-2xl border bg-white p-5 shadow-card md:grid-cols-2 md:p-8">
        <Gallery images={images} emoji={p.emoji} name={p.name} />
        <div className="space-y-4">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h1>
          {vr ? <VariantBuyBox product={p} /> : <>
          <div className="flex flex-wrap items-baseline gap-3"><span className="text-4xl font-extrabold text-primary">{taka(p.price)}</span>{p.oldPrice && p.oldPrice > p.price ? <span className="text-lg text-gray-400 line-through">{taka(p.oldPrice)}</span> : null}{off > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-white">Save {off}%</span>}</div>
          <div><p className="label">Pack size</p><span className="inline-flex rounded-full border-2 border-primary bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">{p.unit}</span></div>
          <p className={`text-sm font-medium ${p.stock > 0 ? "text-emerald-600" : "text-red-600"}`}>{p.stock <= 0 ? "Out of stock" : p.stock <= 10 ? `Only ${p.stock} left in stock` : "In stock"}</p>
          <div className="max-w-sm pt-1"><AddToCart product={p} withQty showBuyNow /></div></>}
          {p.description && <details className="border-t pt-3 text-sm text-gray-600"><summary className="cursor-pointer font-semibold text-gray-800">Product details</summary><p className="mt-2 whitespace-pre-line leading-relaxed">{p.description}</p></details>}
        </div>
      </div>
      {related.length > 0 && <section className="mt-10"><h2 className="mb-4 text-xl font-bold">You may also like</h2><div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div></section>}
    </>
  );
}
