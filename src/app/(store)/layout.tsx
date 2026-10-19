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
export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  // Colours, button shape/size/colour come from Admin → Appearance. Tailwind's primary/accent classes and .btn* read these variables.
  const fx = resolveFx(settings.fx);
  const style = { ...themeVars(settings), "--fx-speed": SPEED_MULT[fx.speed] ?? 1 } as React.CSSProperties;
  const on = (v: boolean) => (fx.enabled && v ? "on" : "off");
  return (
    <div style={style} data-btn={settings.buttonStyle || "solid"} data-fx-entrance={on(fx.entrance)} data-fx-lift={on(fx.cardLift)} data-fx-cat={on(fx.categoryFloat)} data-fx-shine={on(fx.badgeShine)} data-fx-float={on(fx.heroFloat)}>
      <TextsProvider texts={settings.texts} flags={{ showBuyNow: settings.showBuyNow !== false, showWishlist: settings.showWishlist !== false, showCardWhatsapp: settings.showCardWhatsapp !== false, showCardDelivery: settings.showCardDelivery !== false, labelRules: settings.labelRules }}>
        <Header settings={settings} categories={categories} />
        <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-3 pb-24 md:pb-4">{children}</main>
        <Footer settings={settings} categories={categories} />
        <BottomNav />
        <SupportButtons settings={settings} />
      </TextsProvider>
      <MetaPixel pixelId={settings.metaPixelId} />
      <InstallAppPrompt settings={settings} />
    </div>
  );
}
