import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AddToCart from "@/components/store/AddToCart";
import Gallery from "@/components/store/Gallery";
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
  const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u}`);
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, ...(p.description ? { description: p.description } : {}),
    ...(images.length ? { image: images.map(abs) } : {}), ...(p.manufacturer ? { brand: { "@type": "Brand", name: p.manufacturer } } : {}),
    offers: { "@type": "Offer", url: `${SITE_URL}/products/${p.slug}`, priceCurrency: "BDT", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <nav className="mb-4 text-sm text-gray-500"><Link href="/" className="hover:text-primary">Home</Link> / <Link href="/products" className="hover:text-primary">Products</Link>{cat && <> / <Link href={`/products?cat=${cat.id}`} className="hover:text-primary">{cat.name}</Link></>}</nav>
      <div className="grid gap-8 rounded-2xl border bg-white p-5 shadow-card md:grid-cols-2 md:p-8">
        <Gallery images={images} emoji={p.emoji} name={p.name} />
        <div className="space-y-4">
          {cat && <p className="text-sm font-medium text-primary">{cat.name}</p>}
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h1>
          <p className="text-sm text-gray-500">{p.rating > 0 && <>⭐ {p.rating.toFixed(1)} · </>}{p.sold > 0 && <>{p.sold}+ sold · </>}{p.unit}</p>
          <div className="flex items-baseline gap-3"><span className="text-4xl font-extrabold text-primary">{taka(p.price)}</span>{p.oldPrice ? <span className="text-lg text-gray-400 line-through">{taka(p.oldPrice)}</span> : null}{off > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-white">Save {off}%</span>}</div>
          <p className={`text-sm font-medium ${p.stock > 0 ? "text-emerald-600" : "text-red-600"}`}>{p.stock <= 0 ? "Out of stock" : p.stock <= 10 ? `Only ${p.stock} left in stock` : "In stock"}</p>
          {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{p.description}</p>}
          <div className="max-w-sm pt-2"><AddToCart product={p} withQty /></div>
          <ul className="grid gap-2 border-t pt-4 text-sm text-gray-600 sm:grid-cols-2"><li>🚚 Fast home delivery</li><li>💵 Cash on delivery</li><li>🌿 Quality checked</li><li>↩️ Easy support</li></ul>
        </div>
      </div>
      {related.length > 0 && <section className="mt-10"><h2 className="mb-4 text-xl font-bold">You may also like</h2><div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div></section>}
    </>
  );
}
