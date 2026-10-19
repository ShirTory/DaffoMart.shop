import type { DealBadgeSettings, DealKindId, FxSettings, HeroBannerSettings, StoreSettings } from "./types";

export const DEAL_KIND_IDS: DealKindId[] = ["mega", "limited", "hot", "value", "exclusive"];

export const DEFAULT_FX: FxSettings = {
  enabled: true, entrance: true, cardLift: true, categoryFloat: true, badgeShine: true,
  heroFloat: true, heroAutoplay: true, heroIntervalSec: 5.5, speed: "normal",
};
export const DEFAULT_DEALS: DealBadgeSettings = {
  enabled: true, onOffers: true, minDiscount: 5, megaPct: 40, hotPct: 30, valuePct: 20, limitedStock: 5,
  kinds: {
    mega: { on: true, label: "Mega Savings", color: "" },
    limited: { on: true, label: "Limited Offer", color: "" },
    hot: { on: true, label: "Hot Deal", color: "" },
    value: { on: true, label: "Best Value", color: "" },
    exclusive: { on: true, label: "Exclusive Deal", color: "" },
  },
};
export const DEFAULT_HERO: HeroBannerSettings = {
  show: true, ctaLabel: "Shop Deals", ctaHref: "/products?sale=1", showBrowse: true, emojis: "🥕 🍎 🥛 🥬 🥖",
  bgFrom: "", bgTo: "", textColor: "", ctaBg: "", ctaColor: "", bgImage: "", overlay: 45, height: "md", align: "left",
  showEyebrow: true, showShapes: true, transition: "slide", showArrows: true, showDots: true, rounded: true,
};

/** Stored settings are partial: fill every gap from the defaults so the storefront and admin always see a full object. */
export const resolveFx = (s?: StoreSettings["fx"]): FxSettings => ({ ...DEFAULT_FX, ...(s || {}) });
export const resolveHero = (s?: StoreSettings["heroBanner"]): HeroBannerSettings => ({ ...DEFAULT_HERO, ...(s || {}) });
export function resolveDeals(s?: StoreSettings["dealBadges"]): DealBadgeSettings {
  const kinds = { ...DEFAULT_DEALS.kinds };
  for (const k of DEAL_KIND_IDS) kinds[k] = { ...DEFAULT_DEALS.kinds[k], ...(s?.kinds?.[k] || {}) };
  return { ...DEFAULT_DEALS, ...(s || {}), kinds };
}
/** "🥕 🍎, 🥛" -> up to 5 items */
export const parseEmojis = (v: string) => (v || "").split(/[\s,]+/).filter(Boolean).slice(0, 5);
/** Seconds -> clamp, speed word -> duration multiplier (bigger = slower) */
export const SPEED_MULT: Record<FxSettings["speed"], number> = { slow: 1.6, normal: 1, fast: 0.65 };

/** Home banner height: wide on desktop, always capped on phones so it never pushes products off the first screen. Shared by the built-in banner and cover slides. */
export const HERO_HEIGHT: Record<HeroBannerSettings["height"], string> = {
  sm: "aspect-[21/9] max-h-[120px] sm:aspect-[16/4] sm:max-h-none",
  md: "aspect-[21/9] max-h-[140px] sm:aspect-[16/5] sm:max-h-none",
  lg: "aspect-[16/9] max-h-[190px] sm:aspect-[16/6] sm:max-h-none",
};
