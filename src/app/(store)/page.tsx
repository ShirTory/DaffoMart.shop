import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/store/ProductCard";
import HeroSlider from "@/components/store/HeroSlider";
import CopyCode from "@/components/store/CopyCode";
import BuyAgain from "@/components/store/BuyAgain";
import FeatureIcon from "@/components/store/FeatureIcon";
import { getActiveProducts, getBanners, getCategories, getOffers, getSettings } from "@/server/queries";
import { taka } from "@/lib/format";
import { makeT } from "@/lib/texts";
import { validHex } from "@/lib/theme";
import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
export const revalidate = 60;

const Section = ({ title, children, href, emoji, viewAll = "View all →", prominent }: { title: string; children: React.ReactNode; href?: string; emoji?: string; viewAll?: string; prominent?: boolean }) => (
  <section className="mt-5 sm:mt-6">
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className={prominent ? "text-xl font-black tracking-tight text-gray-900 sm:text-2xl md:text-3xl" : "text-lg font-extrabold tracking-tight text-gray-900 sm:text-xl md:text-2xl"}>
        {emoji && <span className="mr-1.5">{emoji}</span>}
        {title}
      </h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          {viewAll}
        </Link>
      )}
    </div>
    {children}
  </section>
);

/** Horizontal product scroller (marketplace style) */
const HScroll = ({ children }: { children: React.ReactNode }) => (
  <div className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    {children}
  </div>
);

const CardWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[42vw] max-w-[180px] shrink-0 sm:w-auto sm:max-w-none">{children}</div>
);

const ICON = { sm: "h-14 w-14 sm:h-16 sm:w-16", md: "h-16 w-16 sm:h-18 sm:w-18", lg: "h-20 w-20 sm:h-24 sm:w-24" } as Record<string, string>;
const ICON_W = { sm: "w-[64px] sm:w-[72px]", md: "w-[72px] sm:w-[80px]", lg: "w-[88px] sm:w-[104px]" } as Record<string, string>;
const SHAPE = { rounded: "rounded-2xl", circle: "rounded-full", square: "rounded-md" } as Record<string, string>;
const GAP = { sm: "gap-1.5", md: "gap-2.5", lg: "gap-4" } as Record<string, string>;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = s.seoTitle || `${s.storeName} – ${s.tagline}`;
  return { ...pageMeta({ title, description: s.seoDescription || undefined, path: "/", image: s.ogImage || undefined }), title: { absolute: title } };
}

export default async function Home() {
  const [products, categories, banners, offers, settings] = await Promise.all([
    getActiveProducts(), getCategories(), getBanners(), getOffers(), getSettings(),
  ]);
  const t = makeT(settings.texts); const va = t("home.viewAll");
  const medCats = categories.filter((c) => c.kind === "medicine");
  const medIds = new Set(medCats.map((c) => c.id));
  const meds = products.filter((p) => medIds.has(p.categoryId));
  const shopCats = categories.filter((c) => c.kind !== "medicine" && c.active !== false && !c.hideOnHome);
  const groc = products.filter((p) => !medIds.has(p.categoryId));
  const featured = groc.filter((p) => p.featured).slice(0, 12);
  const fresh = [...groc].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  const sale = products.filter((p) => p.oldPrice && p.oldPrice > p.price).slice(0, 12);
  const best = [...groc].sort((a, b) => b.sold - a.sold).slice(0, 12);
  const posterOffers = offers.filter((o) => o.image).slice(0, 4);

  return (
    <>
      {/* Admin-managed promotional carousel — headings stay outside images */}
      {banners.length > 0 ? (
        <HeroSlider banners={banners} />
      ) : (
        <section className="relative -mx-4 overflow-hidden bg-gradient-to-r from-primary-deeper via-primary to-primary-dark p-8 text-white sm:mx-0 sm:rounded-2xl sm:p-12">
          <div className="relative z-10 max-w-xl">
            <p className="text-sm font-semibold text-white/80">{settings.storeName}</p>
            <h1 className="mt-2 whitespace-pre-line text-3xl font-extrabold leading-tight sm:text-4xl">{settings.heroTitle}</h1>
            <p className="mt-2 text-white/85">{settings.heroSubtitle || settings.tagline}</p>
            <Link href="/products" className="mt-5 inline-flex rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-accent-dark">
              {settings.heroCta || "Shop now"}
            </Link>
          </div>
        </section>
      )}

      {/* Trust strip — professional icons (Admin → Website Content) */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {(settings.features?.length ? settings.features : [
          { icon: "truck", title: "Fast delivery", text: "Same-day in Dhaka" },
          { icon: "leaf", title: "Always fresh", text: "Quality checked" },
          { icon: "cash", title: "Cash on delivery", text: "Pay when you receive" },
          { icon: "tag", title: "Best prices", text: "Daily offers" },
        ]).slice(0, 4).map((f, k) => (
          <div key={k} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-sm">
            <FeatureIcon icon={f.icon} image={f.image} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{f.title}</p>
              <p className="truncate text-[11px] text-gray-500">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Shop-by-category icons: size, shape, background, labels, spacing and visibility come from Admin → Appearance; each image from Admin → Categories */}
      <BuyAgain />

      {settings.showCatSection !== false && shopCats.length > 0 && (
        <Section title={t("home.categories")} prominent>
          <div className={`scroll-thin -mx-4 flex overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${GAP[settings.catGap || "sm"] ?? GAP.sm}`}>
            {shopCats.map((c) => {
              const bg = validHex(c.iconBg) || validHex(settings.catIconBg);
              // Always circular for a clean professional look
              const shape = "rounded-full";
              return (
                <Link key={c.id} href={`/products?cat=${c.id}`} className={`group flex shrink-0 flex-col items-center ${ICON_W[settings.catIconSize || "sm"] ?? ICON_W.sm}`}>
                  <div className={`flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-gray-100 transition group-hover:scale-105 group-hover:ring-primary ${ICON[settings.catIconSize || "sm"] ?? ICON.sm} ${shape} ${bg ? "" : "bg-gradient-to-b from-gray-50 to-white"}`} style={bg ? { background: bg } : undefined}>
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt={c.name} className={`h-full w-full ${settings.catIconFit === "contain" ? "object-contain p-1.5" : "object-cover"}`} loading="lazy" decoding="async" />
                    ) : (
                      <span className="text-base font-bold text-gray-600 sm:text-lg">{(c.name || "?").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {settings.catShowLabels !== false && <p className="mt-1.5 line-clamp-2 text-center text-[11px] font-bold leading-tight group-hover:text-primary sm:text-xs" style={{ color: validHex(settings.catLabelColor) || "#1f2937" }}>{c.name}</p>}
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* Image offer posters from admin offers (only those with images) */}
      {posterOffers.length > 0 && (
        <Section title={t("home.deals")} emoji="🔥">
          <div className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {posterOffers.map((o) => (
              <div key={o.id} className="relative w-[85vw] max-w-md shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm sm:w-auto sm:max-w-none">
                <div className="relative aspect-[16/7] bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.image!} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {o.badge && <span className="absolute left-3 top-3 rounded bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{o.badge}</span>}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-gray-900">{o.title}</h3>
                  {o.description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{o.description}</p>}
                  {o.code && (
                    <div className="mt-2 flex items-center gap-2">
                      <CopyCode code={o.code} />
                      {o.minOrder > 0 && <span className="text-xs text-gray-400">Min {taka(o.minOrder)}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Text-only offers without images still listed compactly */}
      {offers.filter((o) => !o.image).length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.filter((o) => !o.image).slice(0, 6).map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-xl border bg-gradient-to-r from-accent-soft to-white p-3 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-extrabold text-white">
                {o.discountType === "percent" ? `${o.discountValue}%` : taka(o.discountValue)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{o.title}</p>
                {o.code && <CopyCode code={o.code} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {settings.showMedicine && meds.length > 0 && (
        <Section title={settings.medicineTitle || "Medicine"} href="/medicine" emoji="💊" viewAll={va}>
          <HScroll>
            {meds.slice(0, 10).map((p) => (
              <CardWrap key={p.id}><ProductCard p={p} whatsapp={settings.whatsapp} /></CardWrap>
            ))}
          </HScroll>
        </Section>
      )}

      {sale.length > 0 && (
        <Section title={t("home.hot")} href="/products?sale=1" viewAll={va} emoji="🔥">
          <HScroll>
            {sale.map((p) => (
              <CardWrap key={p.id}><ProductCard p={p} whatsapp={settings.whatsapp} /></CardWrap>
            ))}
          </HScroll>
        </Section>
      )}

      {featured.length > 0 && (
        <Section title={t("home.featured")} href="/products?featured=1" viewAll={va} emoji="⭐">
          <HScroll>
            {featured.map((p) => (
              <CardWrap key={p.id}><ProductCard p={p} whatsapp={settings.whatsapp} /></CardWrap>
            ))}
          </HScroll>
        </Section>
      )}

      {best.some((p) => p.sold > 0) && (
        <Section title={t("home.trending")} href="/products?sort=popular" viewAll={va} emoji="📈">
          <HScroll>
            {best.map((p) => (
              <CardWrap key={p.id}><ProductCard p={p} whatsapp={settings.whatsapp} /></CardWrap>
            ))}
          </HScroll>
        </Section>
      )}

      <Section title={t("home.new")} href="/products" viewAll={va} emoji="✨">
        <HScroll>
          {fresh.map((p) => (
            <CardWrap key={p.id}><ProductCard p={p} whatsapp={settings.whatsapp} /></CardWrap>
          ))}
        </HScroll>
      </Section>

      {products.length === 0 && (
        <p className="mt-10 rounded-2xl border bg-white p-10 text-center text-gray-500">{t("home.soon")}</p>
      )}
    </>
  );
}
