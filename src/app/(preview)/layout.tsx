import { TextsProvider } from "@/components/store/TextsProvider";
import { getSettings } from "@/server/queries";
import { themeVars } from "@/lib/theme";
import { resolveFx, SPEED_MULT } from "@/lib/fx";
import { resolveTheme, themeAttrs, withThemeColors } from "@/lib/storeTheme";

/** Admin-only previews: same theme + card settings as the storefront, but without header, footer, pop-ups or support buttons. */
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Preview" };
export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const fx = resolveFx(settings.fx); const theme = resolveTheme(settings); const ta = themeAttrs(theme);
  const style = { ...themeVars(withThemeColors(settings, theme)), ...ta.vars, "--fx-speed": SPEED_MULT[fx.speed] ?? 1 } as React.CSSProperties;
  const on = (v: boolean) => (fx.enabled && v ? "on" : "off");
  return (
    <div className="store-root min-h-screen" style={{ ...style, ...(theme.preset === "fresh" ? { background: "rgb(var(--c-page))" } : {}) }} {...ta.data} data-btn={settings.buttonStyle || "solid"} data-btn-anim={settings.buttonAnim || "none"} data-fx-entrance={on(fx.entrance)} data-fx-lift={on(fx.cardLift)} data-fx-cat={on(fx.categoryFloat)} data-fx-shine={on(fx.badgeShine)} data-fx-float={on(fx.heroFloat)}>
      <TextsProvider texts={settings.texts} flags={{ showBuyNow: settings.showBuyNow !== false, showWishlist: settings.showWishlist !== false, showCardWhatsapp: settings.showCardWhatsapp !== false, showCardDelivery: settings.showCardDelivery !== false, cardImageRatio: settings.cardImageRatio || "wide", cardStyle: settings.cardStyle || "soft", cardRadius: settings.cardRadius || "xl", cardShowUnit: settings.cardShowUnit !== false, cardShowQtyStepper: settings.cardShowQtyStepper !== false, labelRules: settings.labelRules }}>
        <main className="page-w mx-auto w-full px-4 pb-8 pt-4">{children}</main>
      </TextsProvider>
    </div>
  );
}
