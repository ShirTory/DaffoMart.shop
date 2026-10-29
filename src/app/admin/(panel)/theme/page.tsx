"use client";
import Link from "next/link";
import { ErrorBox, Field, PageHeader, PageLoader, Spinner, Toggle } from "@/components/admin/ui";
import { useSettingsForm } from "@/components/admin/useSettingsForm";
import { FONT_LABEL, FONT_STACKS, HERO_DESKTOP, PRESETS, PRESET_IDS, resolveTheme } from "@/lib/storeTheme";
import type { FontKey, HomeSectionId, StoreThemeSettings, ThemePresetId } from "@/lib/types";

const SECTION_NAMES: [HomeSectionId, string][] = [["categories", "Categories"], ["offerProducts", "Offers carousel"], ["best", "Best sellers"], ["daily", "Daily essentials"], ["fresh", "Fresh food & grocery"], ["household", "Household"], ["sale", "Hot deals"], ["medicine", "Medicine & healthcare"], ["new", "New arrivals"]];
const Sel = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) => <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
const fonts = Object.entries(FONT_LABEL) as [FontKey, string][];

export default function ThemePage() {
  const { f, set, save, busy, errs, loading, error, reload } = useSettingsForm(["storeTheme"]);
  if (loading) return <PageLoader />; if (error || !f) return <ErrorBox msg={error || "Could not load"} retry={reload} />;
  const th = f.storeTheme ?? {}; const r = resolveTheme(f);
  const put = (patch: Partial<StoreThemeSettings>) => set("storeTheme", { ...th, ...patch });
  const choose = (id: ThemePresetId) => set("storeTheme", { preset: id, titles: th.titles, heroMobileHeight: th.heroMobileHeight }); // a preset replaces earlier single-value overrides
  const title = (id: HomeSectionId, v: string) => put({ titles: { ...(th.titles ?? {}), [id]: v } });
  return (
    <>
      <PageHeader title="Website Theme" subtitle="Switch the whole look of the store any time. Changes go live as soon as you save.">
        <a href="/" target="_blank" className="btn-outline">Preview store</a><button className="btn-primary" onClick={() => save()} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save theme</button></PageHeader>
      <section className="card mb-6 p-5"><h2 className="mb-3 text-lg font-bold">Choose a theme</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{PRESET_IDS.map((id) => { const p = PRESETS[id]; const on = r.label === p.label; return (
          <button key={id} type="button" onClick={() => choose(id)} className={`rounded-2xl border-2 p-4 text-left transition ${on ? "border-primary ring-2 ring-primary/20" : "border-gray-200 hover:border-gray-300"}`} style={{ background: p.pageBg }}>
            <div className="mb-3 flex gap-1.5"><span className="h-6 w-6 rounded-full" style={{ background: p.primary }} /><span className="h-6 w-6 rounded-full" style={{ background: p.accent }} /><span className="h-6 flex-1 rounded-full border bg-white" /></div>
            <p className="text-lg font-bold text-gray-900" style={{ fontFamily: FONT_STACKS[p.fontHeading] }}>{p.label}</p><p className="mt-1 text-xs text-gray-600">{p.blurb}</p>{on && <p className="mt-2 text-xs font-bold text-primary">✓ Selected</p>}</button>); })}</div></section>

      <section className="card mb-6 space-y-4 p-5"><h2 className="text-lg font-bold">Colours &amp; typography</h2>
        <Toggle checked={th.useCustomColors ?? Boolean(f.primaryColor && /^#/.test(f.primaryColor))} onChange={(v) => put({ useCustomColors: v })} label="Use my own colours from Appearance instead of the theme's palette" />
        <p className="text-xs text-gray-500">Currently using primary <b style={{ color: r.primary }}>{r.primary}</b> and accent <b style={{ color: r.accent }}>{r.accent}</b>. Change your own colours in <Link href="/admin/appearance" className="font-semibold text-primary underline">Appearance</Link>. Fonts are system fonts (no external download, so pages stay fast).</p>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Heading font"><Sel value={r.fontHeading} onChange={(v) => put({ fontHeading: v as FontKey })} options={fonts} /></Field><Field label="Body font"><Sel value={r.fontBody} onChange={(v) => put({ fontBody: v as FontKey })} options={fonts} /></Field><Field label="Text size"><Sel value={r.baseSize} onChange={(v) => put({ baseSize: v as any })} options={[["sm", "Compact"], ["md", "Normal"], ["lg", "Large"]]} /></Field>
          <Field label="Corners"><Sel value={r.radius} onChange={(v) => put({ radius: v as any })} options={[["sharp", "Sharp"], ["soft", "Soft"], ["round", "Very round"]]} /></Field><Field label="Card style"><Sel value={r.cardStyle} onChange={(v) => put({ cardStyle: v as any })} options={[["shadow", "Soft shadow"], ["border", "Thin border"], ["flat", "Flat"]]} /></Field><Field label="Section headings"><Sel value={r.sectionHeader} onChange={(v) => put({ sectionHeader: v as any })} options={[["plain", "Plain"], ["underline", "Accent underline"], ["pill", "Coloured pill"]]} /></Field>
          <Field label="Page background" error={errs.storeTheme}><div className="flex items-center gap-2"><input type="color" className="h-9 w-12 rounded border bg-white p-0.5" value={r.pageBg} onChange={(e) => put({ pageBg: e.target.value })} /><input className="input font-mono text-xs" value={r.pageBg} maxLength={7} onChange={(e) => put({ pageBg: e.target.value.trim() })} /></div></Field>
          <Field label="Product rows on desktop"><Sel value={r.productLayout} onChange={(v) => put({ productLayout: v as any })} options={[["grid", "Grid (many products visible)"], ["scroll", "One scrolling row"]]} /></Field></div></section>

      <section className="card mb-6 space-y-4 p-5"><h2 className="text-lg font-bold">Hero / cover size</h2>
        <p className="text-xs text-gray-500">Banner images and their text are managed in <Link href="/admin/covers" className="font-semibold text-primary underline">Cover Images</Link> (each banner can have a separate mobile image).</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Desktop height (px): ${r.heroDesktopHeight}`} hint={`Recommended ${HERO_DESKTOP.recommendedMin}–${HERO_DESKTOP.recommendedMax} so more products show above the fold`}><input type="range" className="w-full" min={HERO_DESKTOP.min} max={HERO_DESKTOP.max} step={10} value={r.heroDesktopHeight} onChange={(e) => put({ heroDesktopHeight: Number(e.target.value) })} /></Field>
          <Field label="Mobile height (px)" hint="Empty = the existing mobile cover size (unchanged)"><input className="input" type="number" min={80} max={320} placeholder="unchanged" value={th.heroMobileHeight ?? ""} onChange={(e) => put({ heroMobileHeight: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Image fit"><Sel value={r.heroFit} onChange={(v) => put({ heroFit: v as any })} options={[["cover", "Fill (crop edges)"], ["contain", "Show whole image"]]} /></Field></div></section>

      <section className="card mb-6 space-y-4 p-5"><h2 className="text-lg font-bold">Moving strips</h2>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Category style"><Sel value={r.catStyle} onChange={(v) => put({ catStyle: v as any })} options={[["circle", "Round icons"], ["square", "Square tiles"], ["pill", "Pill chips"]]} /></Field>
          <Field label="Category movement"><Sel value={r.catTicker ? r.catTickerSpeed : "off"} onChange={(v) => v === "off" ? put({ catTicker: false }) : put({ catTicker: true, catTickerSpeed: v as any })} options={[["slow", "Moving — slow"], ["normal", "Moving — normal"], ["fast", "Moving — fast"], ["off", "Still (all categories wrapped)"]]} /></Field>
          <Field label="Offers carousel speed"><Sel value={r.offersSpeed} onChange={(v) => put({ offersSpeed: v as any })} options={[["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]]} /></Field>
          <Field label="Max offer products shown"><input className="input" type="number" min={3} max={40} value={r.offersLimit} onChange={(e) => put({ offersLimit: Number(e.target.value) })} /></Field></div>
        <p className="text-xs text-gray-500">Visitors can pause either strip; with “reduce motion” set on their device the strips stop and show everything statically. The offers carousel lists products that have an Old price above their Price (and are inside their optional offer dates) — edit these on the product.</p></section>

      <section className="card mb-6 space-y-3 p-5"><h2 className="text-lg font-bold">Section headings</h2><p className="text-xs text-gray-500">Leave empty for the default wording. Order and show/hide of sections: <Link href="/admin/content" className="font-semibold text-primary underline">Website Content → Home page sections</Link>.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SECTION_NAMES.map(([id, n]) => <Field key={id} label={n}><input className="input" maxLength={80} value={th.titles?.[id] ?? ""} onChange={(e) => title(id, e.target.value)} /></Field>)}</div></section>
      <div className="flex justify-end"><button className="btn-primary" onClick={() => save()} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save theme</button></div>
    </>
  );
}
