/** Storefront themes. A preset is a complete bundle of look & layout values; the admin can switch presets any time and override single values. Pure (no I/O). */
import type { FontKey, HomeSectionId, StoreSettings, StoreThemeSettings, ThemePresetId } from "./types";
import { BRAND, validHex } from "./theme";

export const FONT_STACKS: Record<FontKey, string> = {
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  humanist: '"Segoe UI", "Trebuchet MS", Optima, Candara, "Noto Sans", system-ui, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, Nunito, system-ui, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", Cambria, "Times New Roman", serif',
};
export const FONT_LABEL: Record<FontKey, string> = { system: "Modern sans (Inter / system)", humanist: "Friendly sans", rounded: "Rounded", serif: "Classic serif" };

export interface ResolvedTheme extends Required<Omit<StoreThemeSettings, "titles" | "heroMobileHeight" | "useCustomColors">> {
  titles: Partial<Record<HomeSectionId, string>>; heroMobileHeight: number | null; primary: string; accent: string; label: string; blurb: string;
}
type Preset = Required<Omit<StoreThemeSettings, "titles" | "heroMobileHeight" | "useCustomColors" | "preset">> & { primary: string; accent: string; label: string; blurb: string };

export const PRESETS: Record<ThemePresetId, Preset> = {
  fresh: { label: "Fresh Market", blurb: "The original DaffoMart look: brand blue & orange, rounded cards, full-colour hero.", primary: BRAND.primary, accent: BRAND.accent, fontHeading: "system", fontBody: "system", baseSize: "md", radius: "soft", cardStyle: "shadow", sectionHeader: "plain", pageBg: "#f9fafb", productLayout: "grid", heroDesktopHeight: 220, heroFit: "cover", catStyle: "circle", catTicker: true, catTickerSpeed: "normal", offersSpeed: "normal", offersLimit: 16 },
  minimal: { label: "Clean Minimal", blurb: "White, flat and airy. Square category tiles, thin borders, grid product rows.", primary: "#111827", accent: "#059669", fontHeading: "system", fontBody: "system", baseSize: "md", radius: "sharp", cardStyle: "border", sectionHeader: "underline", pageBg: "#ffffff", productLayout: "grid", heroDesktopHeight: 200, heroFit: "cover", catStyle: "square", catTicker: true, catTickerSpeed: "slow", offersSpeed: "slow", offersLimit: 12 },
  bold: { label: "Bold Deals", blurb: "High-energy sale look: deep navy with hot red, round shapes, pill headings.", primary: "#1E1B4B", accent: "#E11D48", fontHeading: "rounded", fontBody: "rounded", baseSize: "md", radius: "round", cardStyle: "shadow", sectionHeader: "pill", pageBg: "#f5f3ff", productLayout: "scroll", heroDesktopHeight: 240, heroFit: "cover", catStyle: "pill", catTicker: true, catTickerSpeed: "fast", offersSpeed: "fast", offersLimit: 20 },
  elegant: { label: "Elegant Boutique", blurb: "Warm cream with a serif heading font, burgundy and gold accents, bordered cards.", primary: "#7F1D1D", accent: "#B45309", fontHeading: "serif", fontBody: "humanist", baseSize: "md", radius: "soft", cardStyle: "border", sectionHeader: "underline", pageBg: "#fdf8f0", productLayout: "grid", heroDesktopHeight: 220, heroFit: "cover", catStyle: "circle", catTicker: true, catTickerSpeed: "slow", offersSpeed: "normal", offersLimit: 12 },
};
export const PRESET_IDS = Object.keys(PRESETS) as ThemePresetId[];
export const HERO_DESKTOP = { min: 120, max: 400, recommendedMin: 180, recommendedMax: 240 };

const pick = <T,>(v: T | undefined | null, d: T) => (v === undefined || v === null || (v as unknown) === "" ? d : v);
export function resolveTheme(settings: Partial<StoreSettings>): ResolvedTheme {
  const t = settings.storeTheme ?? {}; const id: ThemePresetId = t.preset && PRESETS[t.preset] ? t.preset : "fresh"; const p = PRESETS[id];
  const mine = t.useCustomColors ?? Boolean(validHex(settings.primaryColor)); // keep colours the admin already chose in Appearance
  const num = (v: unknown, d: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : d; };
  return {
    ...p, preset: id,
    primary: mine && validHex(settings.primaryColor) ? settings.primaryColor! : p.primary, accent: mine && validHex(settings.accentColor) ? settings.accentColor! : p.accent,
    fontHeading: pick(t.fontHeading, p.fontHeading), fontBody: pick(t.fontBody, p.fontBody), baseSize: pick(t.baseSize, p.baseSize), radius: pick(t.radius, p.radius), cardStyle: pick(t.cardStyle, p.cardStyle),
    sectionHeader: pick(t.sectionHeader, p.sectionHeader), pageBg: validHex(t.pageBg) || p.pageBg, productLayout: pick(t.productLayout, p.productLayout),
    heroDesktopHeight: num(t.heroDesktopHeight, p.heroDesktopHeight, HERO_DESKTOP.min, HERO_DESKTOP.max), heroMobileHeight: t.heroMobileHeight ? num(t.heroMobileHeight, 0, 80, 320) || null : null, heroFit: pick(t.heroFit, p.heroFit),
    catStyle: pick(t.catStyle, p.catStyle), catTicker: pick(t.catTicker, p.catTicker), catTickerSpeed: pick(t.catTickerSpeed, p.catTickerSpeed), offersSpeed: pick(t.offersSpeed, p.offersSpeed), offersLimit: num(t.offersLimit, p.offersLimit, 3, 40),
    titles: t.titles ?? {},
  };
}

const SIZE: Record<string, string> = { sm: "15px", md: "16px", lg: "17.5px" };
/** CSS variables + data attributes for the storefront wrapper. */
export function themeAttrs(th: ResolvedTheme) {
  return {
    vars: { "--font-body": FONT_STACKS[th.fontBody], "--font-heading": FONT_STACKS[th.fontHeading], "--page-bg": th.pageBg, "--hero-h-desktop": `${th.heroDesktopHeight}px`, ...(th.heroMobileHeight ? { "--hero-h-mobile": `${th.heroMobileHeight}px` } : {}), "--base-size": SIZE[th.baseSize] ?? "16px" } as Record<string, string>,
    data: { "data-theme": th.preset, "data-radius": th.radius, "data-cards": th.cardStyle, "data-sechead": th.sectionHeader, "data-hero-fit": th.heroFit },
  };
}
/** Colours for the existing themeVars(): the resolved primary/accent replace the raw settings values. */
export const withThemeColors = (s: StoreSettings, th: ResolvedTheme): StoreSettings => ({ ...s, primaryColor: th.primary, accentColor: th.accent });
export const TICKER_SECONDS_PER_ITEM = { slow: 5, normal: 3.2, fast: 2 } as const;
