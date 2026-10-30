"use client";
import Link from "next/link";
import { useRef } from "react";
import AddToCart from "@/components/store/AddToCart";
import Gallery from "@/components/store/Gallery";
import VariantBuyBox from "@/components/store/VariantBuyBox";
import WishlistButton from "@/components/store/WishlistButton";
import ProductCard from "@/components/store/ProductCard";
import { discountPct, taka } from "@/lib/format";
import { hasVariants } from "@/lib/variants";
import { playableVideo, ratingText, visibleDesc, visibleSpecs, type PageLayout, type SectionConfig } from "@/lib/productPage";
import type { Product } from "@/lib/types";
import VideoPlayer from "./VideoPlayer";
import ImageGallery from "./Lightbox";
import Reviews, { Stars, type ReviewsData } from "./Reviews";

export interface ProductPageData {
  product: Product; categoryName?: string; categoryId?: string; layout: PageLayout; sameCategory: Product[]; recommended: Product[]; reviews: ReviewsData; whatsapp?: string;
  /** builder preview: shows a hint instead of silently hiding an empty section, and never submits anything */
  preview?: boolean;
}

function Section({ cfg, children }: { cfg: SectionConfig; children: React.ReactNode }) {
  return (
    <section id={`sec-${cfg.id}`} aria-labelledby={`h-${cfg.id}`} className={`mt-8 scroll-mt-28`}>
      <div className="mb-4"><h2 id={`h-${cfg.id}`} className="text-xl font-bold tracking-tight">{cfg.title}</h2>{cfg.subtitle && <p className="mt-0.5 text-sm text-gray-500">{cfg.subtitle}</p>}</div>
      {children}
    </section>
  );
}
const Empty = ({ why }: { why: string }) => <p className="rounded-xl border border-dashed bg-white/60 p-4 text-center text-xs text-gray-500">Hidden on the live page: {why}</p>;

function Carousel({ items, whatsapp }: { items: Product[]; whatsapp?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const move = (d: number) => ref.current?.scrollBy({ left: d * (ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="relative">
      <ul ref={ref} className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">{items.map((p) => <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[19%]"><ProductCard p={p} whatsapp={whatsapp} /></li>)}</ul>
      {items.length > 2 && <>
        <button type="button" onClick={() => move(-1)} aria-label="Scroll left" className="absolute -left-2 top-1/3 hidden h-9 w-9 items-center justify-center rounded-full border bg-white shadow md:flex">‹</button>
        <button type="button" onClick={() => move(1)} aria-label="Scroll right" className="absolute -right-2 top-1/3 hidden h-9 w-9 items-center justify-center rounded-full border bg-white shadow md:flex">›</button></>}
    </div>
  );
}
const Grid = ({ items, whatsapp }: { items: Product[]; whatsapp?: string }) => <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">{items.map((p) => <ProductCard key={p.id} p={p} whatsapp={whatsapp} />)}</div>;

export default function ProductPage({ data }: { data: ProductPageData }) {
  const { product: p, layout, preview } = data;
  const images = p.images?.length ? p.images : p.image ? [p.image] : [];
  const off = discountPct(p.price, p.oldPrice); const vr = hasVariants(p);
  const rt = ratingText(p.rating, p.reviewCount);
  const desc = visibleDesc(p.descSections); const specs = visibleSpecs(p.specs);
  const showBrandInline = !layout.sections.some((s) => s.id === "brand" && s.enabled);
  const facts = [["Brand", p.brand], ["Manufacturer", p.manufacturer], ["Country of origin", p.countryOfOrigin]].filter(([, v]) => v) as [string, string][];
  const vid = playableVideo(p.video);

  const body = (cfg: SectionConfig) => {
    switch (cfg.id) {
      case "overview": return (
        <div id="sec-overview" className="mt-0">
          <div className="grid gap-8 rounded-2xl border bg-white p-5 shadow-card md:grid-cols-2 md:p-8">
            <Gallery images={images} emoji={p.emoji} name={p.name} />
            <div className="space-y-4">
              {(p.badges?.length || off > 0) ? <div className="flex flex-wrap gap-1.5">{off > 0 && <span className="rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">{off}% OFF</span>}{p.badges?.map((b) => <span key={b} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">{b}</span>)}</div> : null}
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h1>
              {rt ? <a href="#sec-reviews" className="inline-flex items-center gap-2 text-sm"><Stars value={p.rating} /><span className="font-semibold">{rt}</span><span className="text-gray-500">({p.reviewCount} review{p.reviewCount === 1 ? "" : "s"})</span></a> : <p className="text-sm text-gray-400">No reviews yet</p>}
              {vr ? <VariantBuyBox product={p} /> : <>
                <div className="flex flex-wrap items-baseline gap-3"><span className="text-4xl font-extrabold text-primary">{taka(p.price)}</span>{p.oldPrice && p.oldPrice > p.price ? <span className="text-lg text-gray-400 line-through">{taka(p.oldPrice)}</span> : null}{off > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-sm font-bold text-red-600">Save {off}%</span>}</div>
                <div><p className="label">Pack size</p><span className="inline-flex rounded-full border-2 border-primary bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">{p.unit}</span></div>
                <p className={`text-sm font-medium ${p.stock > 0 ? "text-emerald-600" : "text-red-600"}`}>{p.stock <= 0 ? "Out of stock" : p.stock <= 10 ? `Only ${p.stock} left in stock` : "In stock"}</p>
                <div className="max-w-sm pt-1"><AddToCart product={p} withQty showBuyNow /></div></>}
              <div className="flex items-center gap-2"><WishlistButton item={{ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image }} className="static" /><span className="text-sm text-gray-500">Save to wishlist</span></div>
              {showBrandInline && facts.length > 0 && <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t pt-3 text-sm">{facts.map(([k, v]) => <div key={k} className="contents"><dt className="text-gray-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>}
            </div>
          </div>
          {(desc.length > 0 || p.description) && (
            <div className="mt-5 space-y-4 rounded-2xl border bg-white p-5 shadow-card md:p-8">
              {desc.length > 0 ? desc.map((d) => <div key={d.id}>{d.title && <h3 className="mb-1 text-base font-bold">{d.title}</h3>}<p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{d.body}</p></div>)
                : <div><h3 className="mb-1 text-base font-bold">Description</h3><p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{p.description}</p></div>}
            </div>)}
        </div>);
      case "brand": return facts.length || p.manufacturerInfo ? (
        <Section cfg={cfg}><div className="rounded-2xl border bg-white p-5 shadow-card">{facts.length > 0 && <dl className="grid gap-3 sm:grid-cols-3">{facts.map(([k, v]) => <div key={k}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>)}</dl>}{p.manufacturerInfo && <p className={`whitespace-pre-line text-sm leading-relaxed text-gray-700 ${facts.length ? "mt-4 border-t pt-4" : ""}`}>{p.manufacturerInfo}</p>}</div></Section>
      ) : preview ? <Section cfg={cfg}><Empty why="this product has no brand or manufacturer information." /></Section> : null;
      case "specs": return specs.length ? (
        <Section cfg={cfg}><div className="overflow-hidden rounded-2xl border bg-white shadow-card"><dl>{specs.map((s, i) => <div key={s.id} className={`grid gap-1 px-4 py-3 text-sm sm:grid-cols-[220px_1fr] sm:gap-4 ${i % 2 ? "bg-gray-50" : ""}`}><dt className="font-semibold text-gray-700">{s.label}</dt><dd className="text-gray-900">{s.value}</dd></div>)}</dl></div></Section>
      ) : preview ? <Section cfg={cfg}><Empty why="this product has no specifications." /></Section> : null;
      case "video": return vid && p.video ? <Section cfg={cfg}><VideoPlayer video={p.video} name={p.name} /></Section> : preview ? <Section cfg={cfg}><Empty why="this product has no (enabled) video." /></Section> : null;
      case "gallery": return p.extraImages?.length ? <Section cfg={cfg}><ImageGallery images={p.extraImages} name={p.name} /></Section> : preview ? <Section cfg={cfg}><Empty why="this product has no additional images." /></Section> : null;
      case "reviews": return <Section cfg={cfg}><Reviews productId={p.id} data={data.reviews} preview={preview} /></Section>;
      case "sameCategory": case "recommended": {
        const items = cfg.id === "sameCategory" ? data.sameCategory : data.recommended;
        if (!items.length) return preview ? <Section cfg={cfg}><Empty why={cfg.id === "sameCategory" ? "there are no other products to show." : "no recommended products were selected."} /></Section> : null;
        return <Section cfg={cfg}>{cfg.display === "carousel" ? <Carousel items={items} whatsapp={data.whatsapp} /> : <Grid items={items} whatsapp={data.whatsapp} />}</Section>;
      }
    }
  };
  const ordered = layout.sections.filter((s) => s.enabled);
  return (
    <>
      <nav className="mb-4 text-sm text-gray-500"><Link href="/" className="hover:text-primary">Home</Link> / <Link href="/products" className="hover:text-primary">Products</Link>{data.categoryName && <> / <Link href={`/products?cat=${data.categoryId}`} className="hover:text-primary">{data.categoryName}</Link></>} / <span className="text-gray-800">{p.name}</span></nav>
      {ordered.map((cfg) => <div key={cfg.id} data-section={cfg.id}>{body(cfg)}</div>)}
    </>
  );
}
