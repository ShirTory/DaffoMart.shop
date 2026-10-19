import Link from "next/link";
import ProductCard from "@/components/store/ProductCard";
import HeroSlider from "@/components/store/HeroSlider";
import CopyCode from "@/components/store/CopyCode";
import BuyAgain from "@/components/store/BuyAgain";
import FeatureIcon from "@/components/store/FeatureIcon";
import Reveal from "@/components/store/Reveal";
import DealBadge from "@/components/store/DealBadge";
import GroceryBanner from "@/components/store/GroceryBanner";
import { dealInfo, dealKindForOffer, dealKindForProduct } from "@/lib/deals";
import { parseEmojis, resolveDeals, resolveFx, resolveHero } from "@/lib/fx";
import { getActiveProducts, getBanners, getCategories, getOffers, getSettings } from "@/server/queries";
import { discountPct, taka } from "@/lib/format";
import { makeT } from "@/lib/texts";
import { validHex } from "@/lib/theme";
import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import type { HomeSectionConfig, HomeSectionId, Product } from "@/lib/types";

export const revalidate = 60;

const DEFAULT_SECTIONS: HomeSectionConfig[] = [
  { id: "hero", visible: true },
  { id: "features", visible: true },
  { id: "categories", visible: true },
  { id: "buyAgain", visible: true },
  { id: "best", visible: true },
  { id: "daily", visible: true },
  { id: "fresh", visible: true },
  { id: "household", visible: true },
  { id: "offers", visible: true },
  { id: "sale", visible: true },
  { id: "medicine", visible: true },
  { id: "new", visible: true },
];

const Section = ({ title, children, href, emoji, viewAll = "View all →", prominent }: { title: string; children: React.ReactNode; href?: string; emoji?: string; viewAll?: string; prominent?: boolean }) => (
  <section className="mt-4 sm:mt-6">
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

const HScroll = ({ children }: { children: React.ReactNode }) => (
  <div className="scroll-thin -mx-4 -mb-2 -mt-2 flex gap-3 overflow-x-auto px-4 pb-4 pt-2 sm:mx-0 sm:mb-0 sm:mt-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-2 sm:pt-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    {children}
  </div>
);

const CardWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[42vw] max-w-[180px] shrink-0 sm:w-auto sm:max-w-none">{children}</div>
);

const ICON = { sm: "h-14 w-14 sm:h-16 sm:w-16", md: "h-16 w-16 sm:h-18 sm:w-18", lg: "h-20 w-20 sm:h-24 sm:w-24" } as Record<string, string>;
const ICON_W = { sm: "w-[64px] sm:w-[72px]", md: "w-[72px] sm:w-[80px]", lg: "w-[88px] sm:w-[104px]" } as Record<string, string>;
const GAP = { sm: "gap-1.5", md: "gap-2.5", lg: "gap-4" } as Record<string, string>;

function byCats(products: Product[], catIds: string[] | undefined) {
  if (!catIds?.length) return [];
  const set = new Set(catIds);
  return products.filter((p) => set.has(p.categoryId)).slice(0, 12);
}

function resolveSections(cfg?: HomeSectionConfig[]): HomeSectionConfig[] {
  if (!cfg?.length) return DEFAULT_SECTIONS;
  const seen = new Set<string>();
  const out: HomeSectionConfig[] = [];
  for (const s of cfg) {
    if (!s?.id || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, visible: s.visible !== false });
  }
  for (const d of DEFAULT_SECTIONS) {
    if (!seen.has(d.id)) out.push(d);
  }
  return out;
}

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
  const best = [...groc].filter((p) => p.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 12);
  const posterOffers = offers.filter((o) => o.image).slice(0, 4);
  const textOffers = offers.filter((o) => !o.image).slice(0, 6);

  const daily = byCats(groc, settings.homeDailyCatIds);
  const dailyList = daily.length ? daily : featured;
  const freshList = byCats(groc, settings.homeFreshCatIds);
  const freshFinal = freshList.length ? freshList : fresh;
  const household = byCats(groc, settings.homeHouseholdCatIds);

  const fx = resolveFx(settings.fx); const dealCfg = resolveDeals(settings.dealBadges); const hero = resolveHero(settings.heroBanner);
  const sections = resolveSections(settings.homeSections);
  const show = (id: HomeSectionId) => sections.find((s) => s.id === id)?.visible !== false;

  const heroText = { storeName: settings.storeName, title: settings.heroTitle || settings.tagline, subtitle: settings.heroSubtitle || settings.tagline, browseLabel: settings.heroCta || "Shop now" };
  const heroProps = { ctaLabel: hero.ctaLabel || "Shop Deals", ctaHref: hero.ctaHref || "/products?sale=1", emojis: parseEmojis(hero.emojis), browseLabel: hero.showBrowse ? heroText.browseLabel : undefined };
  const heroBlock = (
    <div className="anim-hero">
      {banners.length > 0
        ? <HeroSlider banners={banners} lead={hero.show ? <GroceryBanner {...heroText} {...heroProps} mode="slide" /> : undefined} autoplay={fx.heroAutoplay} intervalMs={Math.round(fx.heroIntervalSec * 1000)} />
        : <GroceryBanner {...heroText} {...heroProps} />}
    </div>
  );

  const featuresBlock = (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
      {(settings.features?.length ? settings.features : [
        { icon: "truck", title: "Fast delivery", text: "Same-day in Dhaka" },
        { icon: "leaf", title: "Always fresh", text: "Quality checked" },
        { icon: "cash", title: "Cash on delivery", text: "Pay when you receive" },
        { icon: "tag", title: "Best prices", text: "Daily offers" },
      ]).slice(0, 4).map((f, k) => (
        <div key={k} className="anim-rise lift lift-sm flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm sm:py-3" style={{ "--d": `${120 + k * 90}ms` } as React.CSSProperties}>
          <FeatureIcon icon={f.icon} image={f.image} className="h-9 w-9 sm:h-10 sm:w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{f.title}</p>
            <p className="truncate text-[11px] text-gray-500">{f.text}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const categoriesBlock = settings.showCatSection !== false && shopCats.length > 0 ? (
    <Section title={t("home.categories")} prominent>
      <div className={`scroll-thin -mx-4 -mt-2 flex overflow-x-auto px-4 pb-1 pt-2 sm:mx-0 sm:mt-0 sm:pt-1 sm:flex-wrap sm:overflow-visible sm:px-0 ${GAP[settings.catGap || "sm"] ?? GAP.sm}`}>
        {shopCats.map((c) => {
          const bg = validHex(c.iconBg) || validHex(settings.catIconBg);
          return (
            <Link key={c.id} href={`/products?cat=${c.id}`} className={`group cat-link flex shrink-0 flex-col items-center ${ICON_W[settings.catIconSize || "sm"] ?? ICON_W.sm}`}>
              <div
                className={`cat-float flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-gray-100 group-hover:ring-primary ${ICON[settings.catIconSize || "sm"] ?? ICON.sm} rounded-full ${bg ? "" : "bg-gradient-to-b from-gray-50 to-white"}`}
                style={bg ? { background: bg } : undefined}
              >
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} className={`h-full w-full ${settings.catIconFit === "contain" ? "object-contain p-1.5" : "object-cover"}`} loading="lazy" decoding="async" />
                ) : (
                  <span className="text-base font-bold text-gray-600 sm:text-lg">{(c.name || "?").charAt(0).toUpperCase()}</span>
                )}
              </div>
              {settings.catShowLabels !== false && (
                <p className="mt-1 line-clamp-2 text-center text-[10px] font-semibold leading-tight group-hover:text-primary sm:text-xs" style={{ color: validHex(settings.catLabelColor) || "#1f2937" }}>{c.name}</p>
              )}
            </Link>
          );
        })}
      </div>
    </Section>
  ) : null;

  const productSection = (title: string, list: Product[], href: string, emoji?: string, deals = false) =>
    list.length > 0 ? (
      <Section title={title} href={href} viewAll={va} emoji={emoji}>
        <HScroll>
          {list.map((p, k) => (
            <CardWrap key={p.id}><ProductCard p={p} whatsapp={settings.whatsapp} deal={deals ? (() => { const k = dealKindForProduct(p, discountPct(p.price, p.oldPrice), dealCfg); return k ? dealInfo(k, dealCfg) : null; })() : null} dealDelay={k * 350} /></CardWrap>
          ))}
        </HScroll>
      </Section>
    ) : null;

  const offersBlock = (posterOffers.length > 0 || textOffers.length > 0) ? (
    <>
      {posterOffers.length > 0 && (
        <Section title={t("home.deals")} emoji="🔥">
          <div className="scroll-thin -mx-4 -mb-2 -mt-2 flex gap-3 overflow-x-auto px-4 pb-4 pt-2 sm:mx-0 sm:mb-0 sm:mt-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-2 sm:pt-0 lg:grid-cols-3">
            {posterOffers.map((o, k) => (
              <Reveal key={o.id} delay={k * 100} className="w-[85vw] max-w-md shrink-0 sm:w-auto sm:max-w-none">
              <div className="lift group/offer relative h-full overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="relative aspect-[16/7] overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.image!} alt="" className="h-full w-full object-cover transition duration-500 motion-safe:group-hover/offer:scale-105" loading="lazy" />
                  {(() => { const dk = dealKindForOffer(o, dealCfg); return dk ? <DealBadge deal={dealInfo(dk, dealCfg)} text={o.badge || undefined} delay={k * 500} className="absolute left-3 top-3 px-2.5 py-1 text-[11px]" /> : o.badge ? <span className="absolute left-3 top-3 rounded bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{o.badge}</span> : null; })()}
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
              </Reveal>
            ))}
          </div>
        </Section>
      )}
      {textOffers.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {textOffers.map((o, k) => (
            <Reveal key={o.id} delay={k * 80}>
            <div className="lift lift-sm relative flex h-full items-center gap-3 rounded-xl border bg-gradient-to-r from-accent-soft to-white p-3 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-extrabold text-white">
                {o.discountType === "percent" ? `${o.discountValue}%` : taka(o.discountValue)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{o.title}</p>
                {o.code && <CopyCode code={o.code} />}
              </div>
              {o.badge && (() => { const dk = dealKindForOffer(o, dealCfg); return dk ? <DealBadge deal={dealInfo(dk, dealCfg)} text={o.badge} delay={k * 500} className="absolute -top-2 right-3" /> : <span className="absolute -top-2 right-3 rounded bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{o.badge}</span>; })()}
            </div>
            </Reveal>
          ))}
        </div>
      )}
    </>
  ) : null;

  const blocks: Record<HomeSectionId, React.ReactNode> = {
    hero: heroBlock,
    features: featuresBlock,
    categories: categoriesBlock,
    buyAgain: <BuyAgain />,
    best: productSection(settings.homeBestTitle || t("home.trending"), best, "/products?sort=popular", "📈"),
    daily: productSection(settings.homeDailyTitle || "Daily Essentials", dailyList, daily.length ? `/products?cat=${settings.homeDailyCatIds![0]}` : "/products?featured=1", "🛒"),
    fresh: productSection(settings.homeFreshTitle || "Fresh Food & Grocery", freshFinal, "/products", "🥬"),
    household: productSection(settings.homeHouseholdTitle || "Household Essentials", household, household.length && settings.homeHouseholdCatIds?.[0] ? `/products?cat=${settings.homeHouseholdCatIds[0]}` : "/products", "🏠"),
    offers: offersBlock,
    sale: productSection(t("home.hot"), sale, "/products?sale=1", "🔥", true),
    medicine: settings.showMedicine && meds.length > 0
      ? productSection(settings.medicineTitle || "Medicine & Healthcare", meds.slice(0, 10), "/medicine", "💊")
      : null,
    new: productSection(t("home.new"), fresh, "/products", "✨"),
  };

  return (
    <>
      {sections.filter((s) => show(s.id)).map((s) => {
        const node = blocks[s.id];
        if (!node) return null;
        return <div key={s.id}>{node}</div>;
      })}
      {products.length === 0 && (
        <p className="mt-10 rounded-2xl border bg-white p-10 text-center text-gray-500">{t("home.soon")}</p>
      )}
    </>
  );
}
