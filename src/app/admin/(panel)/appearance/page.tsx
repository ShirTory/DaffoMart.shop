"use client";
import { ErrorBox, Field, ImageUpload, PageHeader, PageLoader, Spinner, Toggle } from "@/components/admin/ui";
import { useSettingsForm } from "@/components/admin/useSettingsForm";
import { BRAND, themeVars, validHex } from "@/lib/theme";
import type { StoreSettings } from "@/lib/types";

const KEYS: (keyof StoreSettings)[] = ["primaryColor", "accentColor", "secondaryColor", "buttonColor", "buttonTextColor", "buttonStyle", "buttonRadius", "buttonSize", "showBuyNow", "showWishlist", "showCardWhatsapp", "showCardDelivery",
  "showSupportCall", "showSupportWa", "supportCallLabel", "supportWaLabel", "supportCallColor", "supportWaColor", "supportPosition", "supportWaMessage",
  "showCatSection", "catIconSize", "catIconShape", "catIconBg", "catIconFit", "catShowLabels", "catGap", "catLabelColor",
  "footerPromoImage", "footerPromoLink", "footerPromoShow", "footerPromoHeight", "footerPromoBg", "footerPromoAlt", "footerPromoFit", "footerShowPayments", "footerShowCategories",
  "emptyStateIcon", "emptyStateImage", "emptyStateBg", "emptyStateColor", "emptyStateAlign", "seoTitle", "seoDescription", "ogImage", "favicon"];

const Color = ({ label, value, onChange, fallback, hint, allowEmpty }: { label: string; value?: string; onChange: (v: string) => void; fallback: string; hint?: string; allowEmpty?: boolean }) => (
  <Field label={label} hint={hint}>
    <div className="flex items-center gap-2">
      <input type="color" className="h-10 w-12 cursor-pointer rounded border bg-white p-1" value={validHex(value) || fallback} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      <input className="input font-mono" value={value ?? ""} placeholder={fallback} maxLength={7} onChange={(e) => onChange(e.target.value)} />
      {(allowEmpty !== false) && value ? <button type="button" className="btn-ghost btn-sm" onClick={() => onChange("")}>Reset</button> : null}
    </div>
  </Field>
);
const Sel = ({ label, value, onChange, opts, hint }: { label: string; value?: string; onChange: (v: string) => void; opts: [string, string][]; hint?: string }) => (
  <Field label={label} hint={hint}><select className="input" value={value ?? opts[0][0]} onChange={(e) => onChange(e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
);
const Sec = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <section className="card space-y-4 p-5"><div><h2 className="font-bold">{title}</h2>{desc && <p className="text-xs text-gray-500">{desc}</p>}</div>{children}</section>
);

export default function AppearancePage() {
  const { f, set, save, busy, errs, loading, error, reload } = useSettingsForm(KEYS);
  if (loading) return <PageLoader />; if (error || !f) return <ErrorBox msg={error || "Failed to load"} retry={reload} />;
  const sv = (k: keyof StoreSettings) => (v: string) => set(k, (v || undefined) as never);
  const tg = (k: keyof StoreSettings, def = true) => (v: boolean) => set(k, v as never);
  const on = (k: keyof StoreSettings, def = true) => (f[k] === undefined ? def : Boolean(f[k]));
  const vars = themeVars(f) as React.CSSProperties;

  return (
    <>
      <PageHeader title="Appearance" subtitle="Colours, buttons, icons, footer and sharing. Everything here is saved and applied to the live website.">
        <button className="btn-primary" onClick={() => save()} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save changes</button>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-2">
        <Sec title="Brand colours" desc="Used for links, prices, badges, header/footer and every primary button.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Color label="Primary colour" value={f.primaryColor} onChange={sv("primaryColor")} fallback={BRAND.primary} />
            <Color label="Accent colour" value={f.accentColor} onChange={sv("accentColor")} fallback={BRAND.accent} hint="Add-to-cart, offer badges, cart count" />
            <Color label="Footer / top bar colour" value={f.secondaryColor} onChange={sv("secondaryColor")} fallback="#0D1A3E" hint="Empty = a dark shade of the primary colour" />
          </div>
        </Sec>

        <Sec title="Buttons" desc="Applies to every button on the customer website.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Color label="Button colour" value={f.buttonColor} onChange={sv("buttonColor")} fallback={validHex(f.primaryColor) || BRAND.primary} hint="Empty = primary colour" />
            <Color label="Button text colour" value={f.buttonTextColor} onChange={sv("buttonTextColor")} fallback="#FFFFFF" />
            <Sel label="Button style" value={f.buttonStyle} onChange={(v) => set("buttonStyle", v)} opts={[["solid", "Solid (filled)"], ["outline", "Outline"], ["soft", "Soft tint"]]} />
            <Sel label="Button shape" value={f.buttonRadius || "lg"} onChange={(v) => set("buttonRadius", v as never)} opts={[["none", "Square"], ["sm", "Slightly rounded"], ["md", "Rounded"], ["lg", "More rounded"], ["full", "Pill"]]} />
            <Sel label="Button size" value={f.buttonSize || "md"} onChange={(v) => set("buttonSize", v)} opts={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">
            <Toggle checked={on("showBuyNow")} onChange={tg("showBuyNow")} label="Show “Buy now”" />
            <Toggle checked={on("showCardWhatsapp")} onChange={tg("showCardWhatsapp")} label="Show WhatsApp on products" />
            <Toggle checked={on("showWishlist")} onChange={tg("showWishlist")} label="Show wishlist heart" />
            <Toggle checked={on("showCardDelivery")} onChange={tg("showCardDelivery")} label="Show delivery note on cards" />
          </div>
          <div style={vars} data-btn={f.buttonStyle || "solid"} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4">
            <span className="text-xs font-semibold uppercase text-gray-400">Preview</span>
            <button type="button" className="btn-primary">+ Add to bag</button>
            <button type="button" className="btn-primary btn-sm">Small</button>
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: `rgb(var(--c-accent))` }}>৳20 OFF</span>
            <span className="font-bold" style={{ color: "rgb(var(--c-primary))" }}>৳120</span>
          </div>
        </Sec>

        <Sec title="Floating support buttons" desc="Call Now and WhatsApp buttons. Numbers come from Settings & Contact.">
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={on("showSupportCall")} onChange={tg("showSupportCall")} label="Show Call Now" /><Toggle checked={on("showSupportWa")} onChange={tg("showSupportWa")} label="Show WhatsApp" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Call button label"><input className="input" value={f.supportCallLabel ?? ""} placeholder="Call Now" onChange={(e) => set("supportCallLabel", e.target.value)} /></Field>
            <Field label="WhatsApp button label"><input className="input" value={f.supportWaLabel ?? ""} placeholder="WhatsApp" onChange={(e) => set("supportWaLabel", e.target.value)} /></Field>
            <Color label="Call button colour" value={f.supportCallColor} onChange={sv("supportCallColor")} fallback={validHex(f.primaryColor) || BRAND.primary} />
            <Color label="WhatsApp button colour" value={f.supportWaColor} onChange={sv("supportWaColor")} fallback="#25D366" />
            <Sel label="Side of the screen" value={f.supportPosition} onChange={(v) => set("supportPosition", v)} opts={[["right", "Right"], ["left", "Left"]]} />
          </div>
          <Field label="Pre-filled WhatsApp message" hint="Customers see this when the chat opens" error={errs.supportWaMessage}><input className="input" value={f.supportWaMessage ?? ""} placeholder={`Hi ${f.storeName}, I need help with my order.`} onChange={(e) => set("supportWaMessage", e.target.value)} /></Field>
          {(!f.phone || !f.whatsapp) && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{!f.phone && "No phone number yet — the Call button stays hidden. "}{!f.whatsapp && "No WhatsApp number yet — the WhatsApp button stays hidden. "}Add them in <a className="font-semibold underline" href="/admin/settings">Settings &amp; Contact</a>.</p>}
        </Sec>

        <Sec title="Home page category icons" desc="Upload each icon image in Admin → Categories.">
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={on("showCatSection")} onChange={tg("showCatSection")} label="Show this section" /><Toggle checked={on("catShowLabels")} onChange={tg("catShowLabels")} label="Show names under icons" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Sel label="Icon size" value={f.catIconSize || "md"} onChange={(v) => set("catIconSize", v)} opts={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]} />
            <Sel label="Icon shape" value={f.catIconShape || "rounded"} onChange={(v) => set("catIconShape", v)} opts={[["rounded", "Rounded square"], ["circle", "Circle"], ["square", "Square"]]} />
            <Sel label="Image fit" value={f.catIconFit || "cover"} onChange={(v) => set("catIconFit", v)} opts={[["cover", "Fill (crop edges)"], ["contain", "Fit inside (no crop)"]]} />
            <Sel label="Spacing" value={f.catGap || "md"} onChange={(v) => set("catGap", v)} opts={[["sm", "Tight"], ["md", "Normal"], ["lg", "Wide"]]} />
            <Color label="Icon background" value={f.catIconBg} onChange={sv("catIconBg")} fallback="#F3F4F6" hint="Empty = soft default" />
            <Color label="Name colour" value={f.catLabelColor} onChange={sv("catLabelColor")} fallback="#1F2937" />
          </div>
        </Sec>

        <Sec title="Footer" desc="Brand banner and what the footer shows.">
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={on("footerPromoShow")} onChange={tg("footerPromoShow")} label="Show promo banner" /><Toggle checked={on("footerShowPayments")} onChange={tg("footerShowPayments")} label="Show payment methods" /><Toggle checked={on("footerShowCategories")} onChange={tg("footerShowCategories")} label="List categories" /></div>
          <ImageUpload kind="general" label="Footer promotional image / banner" aspect="aspect-[16/5]" value={f.footerPromoImage} onChange={(v) => set("footerPromoImage", v)} hint="Wide image, e.g. 1600×400. Shown above the footer links." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link when clicked (optional)" error={errs.footerPromoLink}><input className="input" value={f.footerPromoLink ?? ""} placeholder="/products?sale=1" onChange={(e) => set("footerPromoLink", e.target.value)} /></Field>
            <Field label="Image description (alt text)"><input className="input" value={f.footerPromoAlt ?? ""} onChange={(e) => set("footerPromoAlt", e.target.value)} /></Field>
            <Sel label="Banner height" value={f.footerPromoHeight || "md"} onChange={(v) => set("footerPromoHeight", v as never)} opts={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]} />
            <Sel label="Image fit" value={f.footerPromoFit || "cover"} onChange={(v) => set("footerPromoFit", v)} opts={[["cover", "Fill (crop edges)"], ["contain", "Fit inside"]]} />
            <Color label="Banner background" value={f.footerPromoBg} onChange={sv("footerPromoBg")} fallback="#FFFFFF" />
          </div>
        </Sec>

        <Sec title="Empty product message look" desc="The wording is in Admin → Website Text → Empty states.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Icon (emoji)"><input className="input text-center text-xl" maxLength={8} value={f.emptyStateIcon ?? ""} placeholder="🔍" onChange={(e) => set("emptyStateIcon", e.target.value)} /></Field>
            <Sel label="Alignment" value={f.emptyStateAlign} onChange={(v) => set("emptyStateAlign", v)} opts={[["center", "Centre"], ["left", "Left"]]} />
            <Color label="Background" value={f.emptyStateBg} onChange={sv("emptyStateBg")} fallback="#FFFFFF" />
            <Color label="Text colour" value={f.emptyStateColor} onChange={sv("emptyStateColor")} fallback="#111827" />
          </div>
          <ImageUpload kind="general" label="Image instead of icon (optional)" aspect="aspect-[3/1]" value={f.emptyStateImage} onChange={(v) => set("emptyStateImage", v)} />
        </Sec>

        <Sec title="Search engines & sharing" desc="Page title, description, browser-tab icon and the picture shown when your link is shared.">
          <Field label="Home page title" hint="Empty = “Store name – Tagline”" error={errs.seoTitle}><input className="input" maxLength={70} value={f.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} /></Field>
          <Field label="Description (meta)" hint="About 150 characters" error={errs.seoDescription}><textarea className="input min-h-[72px]" maxLength={200} value={f.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUpload kind="general" label="Sharing image (1200×630)" aspect="aspect-[1200/630]" value={f.ogImage} onChange={(v) => set("ogImage", v)} />
            <ImageUpload kind="general" label="Favicon (square, 512×512)" aspect="aspect-square" value={f.favicon} onChange={(v) => set("favicon", v)} hint="Empty = the built-in DaffoMart icon" />
          </div>
        </Sec>
      </div>
    </>
  );
}
