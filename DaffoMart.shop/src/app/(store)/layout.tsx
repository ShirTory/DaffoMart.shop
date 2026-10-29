import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import BottomNav from "@/components/store/BottomNav";
import SupportButtons from "@/components/store/SupportButtons";
import MetaPixel from "@/components/store/MetaPixel";
import InstallAppPrompt from "@/components/store/InstallAppPrompt";
import { TextsProvider } from "@/components/store/TextsProvider";
import { getCategories, getSettings } from "@/server/queries";
import { themeVars } from "@/lib/theme";
import { resolveFx, SPEED_MULT } from "@/lib/fx";
import { resolveTheme, themeAttrs, withThemeColors } from "@/lib/storeTheme";
export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  // Colours, button shape/size/colour come from Admin → Appearance. Tailwind's primary/accent classes and .btn* read these variables.
  const fx = resolveFx(settings.fx);
  const theme = resolveTheme(settings); const ta = themeAttrs(theme); // Admin → Website Theme
  const style = { ...themeVars(withThemeColors(settings, theme)), ...ta.vars, "--fx-speed": SPEED_MULT[fx.speed] ?? 1 } as React.CSSProperties;
  const on = (v: boolean) => (fx.enabled && v ? "on" : "off");
  return (
    <div className="store-root flex min-h-screen flex-col" style={{ ...style, ...(theme.preset === "fresh" ? { background: "rgb(var(--c-page))" } : {}) }} {...ta.data} data-btn={settings.buttonStyle || "solid"} data-btn-anim={settings.buttonAnim || "none"} data-fx-entrance={on(fx.entrance)} data-fx-lift={on(fx.cardLift)} data-fx-cat={on(fx.categoryFloat)} data-fx-shine={on(fx.badgeShine)} data-fx-float={on(fx.heroFloat)}>
      <TextsProvider texts={settings.texts} flags={{ showBuyNow: settings.showBuyNow !== false, showWishlist: settings.showWishlist !== false, showCardWhatsapp: settings.showCardWhatsapp !== false, showCardDelivery: settings.showCardDelivery !== false, cardImageRatio: settings.cardImageRatio || "wide", cardStyle: settings.cardStyle || "soft", cardRadius: settings.cardRadius || "xl", cardShowUnit: settings.cardShowUnit !== false, cardShowQtyStepper: settings.cardShowQtyStepper !== false, labelRules: settings.labelRules }}>
        <Header settings={settings} categories={categories} />
        <main className="page-w mx-auto w-full flex-1 px-4 pb-4 pt-4 md:pb-8">{children}</main>
        <Footer settings={settings} categories={categories} />
        <BottomNav />
        <SupportButtons settings={settings} />
      </TextsProvider>
      <MetaPixel pixelId={settings.metaPixelId} />
      <InstallAppPrompt settings={settings} />
    </div>
  );
}
