"use client";
import { ErrorBox, Field, ImageUpload, PageHeader, PageLoader, Spinner, Toggle } from "@/components/admin/ui";
import { useSettingsForm } from "@/components/admin/useSettingsForm";
import { BRAND, themeVars, validHex } from "@/lib/theme";
import AnnouncementBar from "@/components/store/AnnouncementBar";
import ButtonDesigner from "@/components/admin/ButtonDesigner";
import type { StoreSettings } from "@/lib/types";

const KEYS: (keyof StoreSettings)[] = [
  "announcement", "announcementIcon", "announcementLink", "announcementCta", "announcementBg", "announcementColor", "announcementStyle", "announcementSize", "announcementDismissible", "announcementSpeed", "announcementWeight", "announcementDirection", "announcementSep",
  "headerTheme", "headerBg", "headerText", "headerSticky", "headerShowCategories", "headerShowOrders", "headerShowTrack", "headerShowContact", "headerSearchStyle", "headerCartStyle", "headerMedicineStyle", "headerCartBtn", "headerMedicineBtn", "headerLinkBtn",
  "buttonWeight", "buttonAnim", "buttonShadow", "medCtaShow", "medCtaDevices", "medCtaStyle", "medCtaTitle", "medCtaSubtitle", "medCtaLabel", "medCtaBg", "medCtaBg2", "medCtaText", "medCtaBtn", "catLayout", "catStyle", "catCardBg", "catShowSeeAll",
  "cardImageRatio", "cardStyle", "cardRadius", "cardShowUnit", "cardShowQtyStepper", "cardPriceColor", "pageBg", "pageWidth",
  "primaryColor", "accentColor", "secondaryColor", "buttonColor", "buttonTextColor", "buttonStyle", "buttonRadius", "buttonSize", "showBuyNow", "showWishlist", "showCardWhatsapp", "showCardDelivery",
  "showSupportCall", "showSupportWa", "supportCallLabel", "supportWaLabel", "supportCallColor", "supportWaColor", "supportPosition", "supportWaMessage",
  "navAllImage", "navMedicineImage", "navOffersImage", "showCatSection", "catIconSize", "catIconShape", "catIconBg", "catIconFit", "catShowLabels", "catGap", "catLabelColor",
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
        <Sec title="Announcement bar" desc="The strip above the header. It automatically uses a colour that stands out from the header, with readable text.">
          <div style={vars} className="-mx-1 overflow-hidden rounded-xl border border-gray-200"><AnnouncementBar settings={{ ...f, announcement: f.announcement || "Your announcement shows here" }} /></div>
          <Field label="Headlines" hint="One headline per line. Empty = the bar is hidden. Several lines run one after another." error={errs.announcement}><textarea className="input min-h-[84px]" maxLength={600} value={f.announcement ?? ""} placeholder={"Free delivery on orders over ৳500\nCash on delivery available"} onChange={(e) => set("announcement", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Icon (emoji)" hint="Empty = megaphone icon"><input className="input text-center text-lg" maxLength={8} value={f.announcementIcon ?? ""} placeholder="📢" onChange={(e) => set("announcementIcon", e.target.value || undefined)} /></Field>
            <Sel label="Text size" value={f.announcementSize} onChange={(v) => set("announcementSize", v as never)} opts={[["md", "Medium"], ["sm", "Small"], ["lg", "Large"]]} />
            <Field label="Link when clicked (optional)" error={errs.announcementLink}><input className="input" value={f.announcementLink ?? ""} placeholder="/products?sale=1" onChange={(e) => set("announcementLink", e.target.value || undefined)} /></Field>
            <Field label="Small button text (optional)" hint="Needs a link, e.g. Shop now"><input className="input" maxLength={30} value={f.announcementCta ?? ""} onChange={(e) => set("announcementCta", e.target.value || undefined)} /></Field>
            <Color label="Background colour" value={f.announcementBg} onChange={sv("announcementBg")} fallback="#0D1A3E" hint="Empty = automatic" />
            <Color label="Text colour" value={f.announcementColor} onChange={sv("announcementColor")} fallback="#FFFFFF" hint="Empty = automatic (readable)" />
            <Sel label="Movement" value={f.announcementStyle} onChange={(v) => set("announcementStyle", v as never)} opts={[["static", "Still, centred"], ["marquee", "Scrolling headline (news ticker)"], ["bounce", "Back and forth (slides to the end and returns)"], ["rotate", "One headline at a time (needs 2+ lines)"]]} />
            <Sel label="Speed" value={f.announcementSpeed} onChange={(v) => set("announcementSpeed", v as never)} opts={[["normal", "Normal"], ["slow", "Slow"], ["fast", "Fast"]]} />
            <Sel label="Text boldness" value={f.announcementWeight} onChange={(v) => set("announcementWeight", v as never)} opts={[["semibold", "Semi-bold"], ["normal", "Normal"], ["bold", "Bold"], ["black", "Extra bold"]]} />
            <Sel label="Scroll direction" value={f.announcementDirection} onChange={(v) => set("announcementDirection", v as never)} opts={[["left", "Right to left"], ["right", "Left to right"]]} hint="Only for the scrolling style" />
            <Field label="Separator between headlines" hint="e.g. • or ✦ or |"><input className="input text-center" maxLength={4} value={f.announcementSep ?? ""} placeholder="•" onChange={(e) => set("announcementSep", e.target.value || undefined)} /></Field>
          </div>
          <Toggle checked={on("announcementDismissible", false)} onChange={tg("announcementDismissible", false)} label="Let visitors close the bar (it returns when you change the message)" />
        </Sec>

        <Sec title="Header" desc="The top bar with logo, search, medicine, wishlist and cart.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Sel label="Header style" value={f.headerTheme} onChange={(v) => set("headerTheme", v as never)} opts={[["light", "Light (white, clean)"], ["brand", "Brand (deep colour)"]]} hint="Light is the most readable and professional" />
            <Sel label="Stays visible while scrolling" value={f.headerSticky} onChange={(v) => set("headerSticky", v as never)} opts={[["bar", "Top bar only (recommended)"], ["all", "Top bar and categories"], ["none", "Scrolls away"]]} />
            <Color label="Custom background" value={f.headerBg} onChange={sv("headerBg")} fallback="#FFFFFF" hint="Empty = from the style above. Text colour adjusts itself." />
            <Color label="Custom text colour" value={f.headerText} onChange={sv("headerText")} fallback="#1F2937" hint="Empty = automatic" />
            <Sel label="Search box shape" value={f.headerSearchStyle} onChange={(v) => set("headerSearchStyle", v as never)} opts={[["pill", "Pill"], ["box", "Rounded box"]]} />
            <Sel label="Cart button" value={f.headerCartStyle} onChange={(v) => set("headerCartStyle", v as never)} opts={[["accent", "Accent colour (orange)"], ["primary", "Primary colour (navy)"], ["outline", "Outline"]]} />
            <Sel label="Medicine button" value={f.headerMedicineStyle} onChange={(v) => set("headerMedicineStyle", v as never)} opts={[["soft", "Soft green"], ["solid", "Solid green"], ["plain", "Text only"]]} />
          </div>
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-bold text-gray-900">Header buttons — full control</p>
            <p className="-mt-3 text-xs text-gray-500">Colour, size, boldness, shape, animation and shadow for each header button. “Default” keeps the look chosen above.</p>
            <ButtonDesigner title="Cart button" sample="Cart" themeStyle={vars} value={f.headerCartBtn} onChange={(v) => set("headerCartBtn", v)} preset={{ style: "solid", bg: "rgb(var(--c-accent))", color: "#FFFFFF" }} />
            <ButtonDesigner title="Medicine button (laptop header)" sample="+ Medicine" themeStyle={vars} value={f.headerMedicineBtn} onChange={(v) => set("headerMedicineBtn", v)} preset={{ style: "soft", bg: "#047857" }} />
            <ButtonDesigner title="Text links (My orders, Track order, Contact)" sample="My orders" themeStyle={vars} value={f.headerLinkBtn} onChange={(v) => set("headerLinkBtn", v)} preset={{ style: "plain", bg: "#4B5563", weight: "medium" }} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">
            <Toggle checked={on("headerShowCategories")} onChange={tg("headerShowCategories")} label="Show the category icon strip" />
            <Toggle checked={on("headerShowOrders")} onChange={tg("headerShowOrders")} label="“My orders” link" />
            <Toggle checked={on("headerShowTrack")} onChange={tg("headerShowTrack")} label="“Track order” link" />
            <Toggle checked={on("headerShowContact", false)} onChange={tg("headerShowContact", false)} label="“Contact” link" />
          </div>
        </Sec>

        <Sec title="Product cards" desc="How products look on the home page, product lists and medicine page.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Sel label="Photo shape" value={f.cardImageRatio} onChange={(v) => set("cardImageRatio", v as never)} opts={[["wide", "Wide (compact, recommended)"], ["square", "Square"], ["tall", "Tall (good for medicine boxes)"]]} />
            <Sel label="Card style" value={f.cardStyle} onChange={(v) => set("cardStyle", v as never)} opts={[["soft", "Soft shadow"], ["outlined", "Thin outline"], ["flat", "Flat (no border)"]]} />
            <Sel label="Corner roundness" value={f.cardRadius} onChange={(v) => set("cardRadius", v as never)} opts={[["xl", "Very round"], ["lg", "Round"], ["md", "Slightly round"]]} />
            <Color label="Price colour" value={f.cardPriceColor} onChange={sv("cardPriceColor")} fallback="#B45309" hint="Empty = a deeper shade of the accent colour" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">
            <Toggle checked={on("cardShowUnit")} onChange={tg("cardShowUnit")} label="Show “/ 1 kg” next to the price" />
            <Toggle checked={on("cardShowQtyStepper")} onChange={tg("cardShowQtyStepper")} label="Show the − 1 + quantity picker" />
          </div>
          <p className="text-xs text-gray-500">“Buy now”, WhatsApp and delivery-note switches are in the <b>Buttons</b> section below.</p>
        </Sec>

        <Sec title="Page" desc="Background and width of the whole customer website.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Color label="Page background" value={f.pageBg} onChange={sv("pageBg")} fallback="#F6F7FB" hint="Empty = soft grey-blue" />
            <Sel label="Content width" value={f.pageWidth} onChange={(v) => set("pageWidth", v as never)} opts={[["normal", "Normal (1280 px)"], ["wide", "Wide (1440 px, for large screens)"]]} />
          </div>
        </Sec>

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
            <Sel label="Text boldness" value={f.buttonWeight || "semibold"} onChange={(v) => set("buttonWeight", v as never)} opts={[["medium", "Normal"], ["semibold", "Semi-bold"], ["bold", "Bold"], ["black", "Extra bold"]]} />
            <Sel label="Animation" value={f.buttonAnim || "none"} onChange={(v) => set("buttonAnim", v as never)} opts={[["none", "None"], ["lift", "Lift on hover"], ["pulse", "Pulse"], ["shine", "Shine sweep"], ["bounce", "Bounce"], ["glow", "Glow ring"]]} hint="For Add to bag and other main buttons" />
            <Sel label="Shadow" value={f.buttonShadow || "none"} onChange={(v) => set("buttonShadow", v as never)} opts={[["none", "None"], ["soft", "Soft"], ["strong", "Strong"]]} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">
            <Toggle checked={on("showBuyNow")} onChange={tg("showBuyNow")} label="Show “Buy now”" />
            <Toggle checked={on("showCardWhatsapp")} onChange={tg("showCardWhatsapp")} label="Show WhatsApp on products" />
            <Toggle checked={on("showWishlist")} onChange={tg("showWishlist")} label="Show wishlist heart" />
            <Toggle checked={on("showCardDelivery")} onChange={tg("showCardDelivery")} label="Show delivery note on cards" />
          </div>
          <div style={vars} data-btn={f.buttonStyle || "solid"} data-btn-anim={f.buttonAnim || "none"} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4">
            <span className="text-xs font-semibold uppercase text-gray-400">Preview</span>
            <button type="button" className="btn-primary">+ Add to bag</button>
            <button type="button" className="btn-primary btn-sm">Small</button>
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: `rgb(var(--c-accent))` }}>৳20 OFF</span>
            <span className="font-bold" style={{ color: "rgb(var(--c-primary))" }}>৳120</span>
          </div>
        </Sec>

        <Sec title="Medicine button (home page)" desc="A highlighted way into the pharmacy on the home page. On phones the category strip is hidden, so this is the main entrance.">
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={on("medCtaShow")} onChange={tg("medCtaShow")} label="Show the medicine button" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Sel label="Layout" value={f.medCtaStyle} onChange={(v) => set("medCtaStyle", v as never)} opts={[["banner", "Banner card with button"], ["button", "One wide button"]]} />
            <Sel label="Shown on" value={f.medCtaDevices} onChange={(v) => set("medCtaDevices", v as never)} opts={[["mobile", "Phones only"], ["all", "Phones and computers"]]} />
            <Field label="Title" hint="Empty = medicine page title"><input className="input" maxLength={60} value={f.medCtaTitle ?? ""} placeholder={f.medicineTitle || "Medicine & Healthcare"} onChange={(e) => set("medCtaTitle", e.target.value || undefined)} /></Field>
            <Field label="Button text"><input className="input" maxLength={30} value={f.medCtaLabel ?? ""} placeholder="Order medicine" onChange={(e) => set("medCtaLabel", e.target.value || undefined)} /></Field>
            <Field label="Small line under the title" className="sm:col-span-2"><input className="input" maxLength={120} value={f.medCtaSubtitle ?? ""} placeholder="Genuine medicines & health products, delivered fast" onChange={(e) => set("medCtaSubtitle", e.target.value)} /></Field>
            <Color label="Colour 1" value={f.medCtaBg} onChange={sv("medCtaBg")} fallback="#047857" />
            <Color label="Colour 2 (gradient end)" value={f.medCtaBg2} onChange={sv("medCtaBg2")} fallback="#10B981" />
            <Color label="Text colour" value={f.medCtaText} onChange={sv("medCtaText")} fallback="#FFFFFF" hint="Empty = automatic" />
          </div>
          <ButtonDesigner title="Button design" sample={f.medCtaLabel || "Order medicine"} themeStyle={vars} value={f.medCtaBtn} onChange={(v) => set("medCtaBtn", v)} preset={{ style: "solid", bg: "#FFFFFF", color: "#047857", size: "sm", weight: "bold", anim: "shine" }} />
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

        <Sec title="Top category bar icons" desc="Optional images for the All, Medicine and Offers icons. Empty = letter icon."><div className="grid gap-4 sm:grid-cols-3"><ImageUpload kind="general" label="All icon" aspect="aspect-square" value={f.navAllImage} onChange={(v) => set("navAllImage", v)} hint="Square, e.g. 256x256" /><ImageUpload kind="general" label="Medicine icon" aspect="aspect-square" value={f.navMedicineImage} onChange={(v) => set("navMedicineImage", v)} hint="Square, e.g. 256x256" /><ImageUpload kind="general" label="Offers icon" aspect="aspect-square" value={f.navOffersImage} onChange={(v) => set("navOffersImage", v)} hint="Square, e.g. 256x256" /></div></Sec>
        <Sec title="Home page category icons" desc="Upload each icon image in Admin → Categories.">
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={on("showCatSection")} onChange={tg("showCatSection")} label="Show this section" /><Toggle checked={on("catShowLabels")} onChange={tg("catShowLabels")} label="Show category names" /><Toggle checked={on("catShowSeeAll")} onChange={tg("catShowSeeAll")} label="Show “View all” link" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Sel label="Look" value={f.catStyle || "card"} onChange={(v) => set("catStyle", v as never)} opts={[["card", "Cards (white card + picture + name)"], ["tile", "Picture tiles (name on the picture)"], ["circle", "Round icons"]]} hint="Cards and tiles clearly look tappable" />
            <Sel label="Layout" value={f.catLayout || "scroll"} onChange={(v) => set("catLayout", v as never)} opts={[["scroll", "Swipe sideways"], ["grid", "Grid (all categories visible)"]]} />
            <Color label="Card background" value={f.catCardBg} onChange={sv("catCardBg")} fallback="#FFFFFF" hint="Cards look only" />
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
