"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, ImageUpload, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import type { Banner } from "@/lib/types";

type Form = {
  title: string; subtitle: string; image?: string; mobileImage?: string; ctaLabel: string; ctaHref: string; active: boolean; sortOrder: string;
  alt: string; fit: "cover" | "contain"; bg: string; overlay: "auto" | "none" | "dark" | "light"; textColor: string; align: "left" | "center" | "right";
  ctaBg: string; ctaColor: string; newTab: boolean; startsAt: string; endsAt: string;
};
const DEFAULTS: Omit<Form, "title" | "subtitle" | "ctaLabel" | "ctaHref" | "active" | "sortOrder"> = { alt: "", fit: "cover", bg: "", overlay: "auto", textColor: "", align: "left", ctaBg: "", ctaColor: "", newTab: false, startsAt: "", endsAt: "" };
const isAnimated = (u?: string) => !!u && /\.gif(\?|$)/i.test(u);
const dateIn = (v?: string) => (v ? v.slice(0, 10) : "");
const Color = ({ label, value, onChange, fallback }: { label: string; value: string; onChange: (v: string) => void; fallback: string }) => (
  <Field label={label}><div className="flex items-center gap-2">
    <input type="color" className="h-10 w-12 cursor-pointer rounded border bg-white p-1" value={/^#[0-9a-f]{6}$/i.test(value) ? value : fallback} onChange={(e) => onChange(e.target.value)} aria-label={label} />
    <input className="input font-mono" value={value} placeholder="Automatic" maxLength={7} onChange={(e) => onChange(e.target.value)} />
    {value && <button type="button" className="btn-ghost btn-sm" onClick={() => onChange("")}>Reset</button>}
  </div></Field>
);
const Seg = <T extends string>({ label, value, onChange, opts }: { label: string; value: T; onChange: (v: T) => void; opts: [T, string][] }) => (
  <Field label={label}><div className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white" role="radiogroup" aria-label={label}>
    {opts.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`px-3 py-2 text-sm font-medium transition ${value === v ? "bg-primary text-white" : "text-gray-700 hover:bg-gray-50"}`}>{l}</button>)}
  </div></Field>
);
export default function CoversPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const { data, setData, loading, error, reload } = useList<Banner[]>("/api/banners");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const open = (b?: Banner) => { setErrs({}); setEdit(b ? { id: b.id, f: { ...DEFAULTS, title: b.title, subtitle: b.subtitle, image: b.image, mobileImage: b.mobileImage, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref, active: b.active, sortOrder: String(b.sortOrder),
    alt: b.alt ?? "", fit: b.fit ?? "cover", bg: b.bg ?? "", overlay: b.overlay ?? "auto", textColor: b.textColor ?? "", align: b.align ?? "left", ctaBg: b.ctaBg ?? "", ctaColor: b.ctaColor ?? "", newTab: !!b.newTab, startsAt: dateIn(b.startsAt), endsAt: dateIn(b.endsAt) } }
    : { f: { ...DEFAULTS, title: "", subtitle: "", ctaLabel: "", ctaHref: "/products", active: true, sortOrder: String((data?.length ?? 0) + 1) } }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const s = await api<Banner>(edit.id ? `/api/banners/${edit.id}` : "/api/banners", { method: edit.id ? "PUT" : "POST", body: { ...edit.f, image: edit.f.image ?? "", startsAt: edit.f.startsAt ? new Date(`${edit.f.startsAt}T00:00:00`).toISOString() : "", endsAt: edit.f.endsAt ? new Date(`${edit.f.endsAt}T23:59:59`).toISOString() : "" } });
      setData((d) => (edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [...(d ?? []), s]).sort((a, b) => a.sortOrder - b.sortOrder));
      toast("Cover image saved"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (b: Banner) => { if (!(await confirm("Delete this cover image?"))) return; try { await api(`/api/banners/${b.id}`, { method: "DELETE" }); setData((d) => d!.filter((x) => x.id !== b.id)); toast("Deleted"); } catch (e: any) { toast(e.message, "err"); } };
  const flip = async (b: Banner) => { try { const s = await api<Banner>(`/api/banners/${b.id}`, { method: "PUT", body: { ...b, active: !b.active } }); setData((d) => d!.map((x) => (x.id === s.id ? s : x))); } catch (e: any) { toast(e.message, "err"); } };

  return (
    <>
      <PageHeader title="Cover Images" subtitle="Slides shown at the top of your home page: photos, designs or animated GIFs. If none are active, the built-in animated banner is shown."><button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add cover image</button></PageHeader>
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Recommended size: <b>1920 × 600 px</b> (wide). <b>GIF and animated WebP are supported</b> and keep playing. Keep a GIF under <b>4 MB</b> (short loop, about 800–1200 px wide), or paste a link to a GIF hosted elsewhere. Keep important text near the centre, and add a separate image for phones if you like.</div>
      {loading ? <PageLoader /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.length ? <div className="card"><Empty icon="covers" title="No cover images yet" hint="Upload a wide image to show a slider on your home page." action={<button className="btn-primary" onClick={() => open()}>Add cover image</button>} /></div> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.map((b) => (
            <div key={b.id} className="card overflow-hidden">
              <div className="relative aspect-[16/5] bg-gray-100" style={b.bg ? { background: b.bg } : undefined}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={b.image} alt="" className={`h-full w-full ${b.fit === "contain" ? "object-contain" : "object-cover"}`} />
                {isAnimated(b.image) && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">GIF</span>}
                {(b.startsAt || b.endsAt) && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-gray-700">Scheduled</span>}
                {(b.title || b.subtitle) && <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/55 to-transparent p-5 text-white"><p className="text-lg font-bold">{b.title}</p><p className="text-sm text-white/85">{b.subtitle}</p></div>}</div>
              <div className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><Toggle checked={b.active} onChange={() => flip(b)} /><StatusBadge status={b.active ? "active" : "inactive"} label={b.active ? "Showing" : "Hidden"} /><span className="text-xs text-gray-400">Order #{b.sortOrder}</span></div>
                <div><button className="btn-ghost btn-sm" onClick={() => open(b)}><Icon name="edit" className="h-4 w-4" />Edit</button><button className="btn-ghost btn-sm text-red-600" onClick={() => del(b)}><Icon name="trash" className="h-4 w-4" /></button></div></div>
            </div>))}
        </div>)}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit cover image" : "Add cover image"} wide
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && <div className="space-y-4">
          <ImageUpload kind="banner" allowUrl fit={edit.f.fit} label="Cover image or GIF (desktop)" aspect="aspect-[16/5]" value={edit.f.image} onChange={(v) => set("image", v)} hint="Wide image, 1920 × 600 px recommended. GIF, JPG, PNG and WebP work." />
          {errs.image && <p className="text-xs text-red-600">{errs.image}</p>}
          <div className="max-w-xs"><ImageUpload kind="banner" allowUrl fit={edit.f.fit} label="Mobile image (optional)" aspect="aspect-[4/3]" value={edit.f.mobileImage} onChange={(v) => set("mobileImage", v)} hint="e.g. 1000 × 750 px. Empty = the desktop image is used." /></div>

          <div className="space-y-4 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold">Text on the cover <span className="font-normal text-gray-400">(all optional)</span></h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline"><input className="input" value={edit.f.title} onChange={(e) => set("title", e.target.value)} placeholder="Fresh groceries, delivered fast" maxLength={120} /></Field>
              <Field label="Sub-headline"><input className="input" value={edit.f.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={240} /></Field>
              <Field label="Button text" hint="Empty = no button; the whole cover is still clickable if a link is set"><input className="input" value={edit.f.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Shop now" maxLength={40} /></Field>
              <Field label="Link" hint="e.g. /products or /products?cat=fruit. A full https:// link opens in a new tab."><input className="input" value={edit.f.ctaHref} onChange={(e) => set("ctaHref", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Seg label="Text position" value={edit.f.align} onChange={(v) => set("align", v)} opts={[["left", "Left"], ["center", "Centre"], ["right", "Right"]]} />
              <Seg label="Darken image behind text" value={edit.f.overlay} onChange={(v) => set("overlay", v)} opts={[["auto", "Auto"], ["dark", "Dark"], ["light", "Light"], ["none", "None"]]} />
              <Color label="Text colour" value={edit.f.textColor} onChange={(v) => set("textColor", v)} fallback="#FFFFFF" />
              <Color label="Button colour" value={edit.f.ctaBg} onChange={(v) => set("ctaBg", v)} fallback="#F7941D" />
              <Color label="Button text colour" value={edit.f.ctaColor} onChange={(v) => set("ctaColor", v)} fallback="#FFFFFF" />
            </div>
            <Toggle checked={edit.f.newTab} onChange={(v) => set("newTab", v)} label="Open the link in a new tab" />
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold">Image fit &amp; accessibility</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Seg label="Image fit" value={edit.f.fit} onChange={(v) => set("fit", v)} opts={[["cover", "Fill (crop edges)"], ["contain", "Show whole image"]]} />
              <Color label="Background behind the image" value={edit.f.bg} onChange={(v) => set("bg", v)} fallback="#FFFFFF" />
              <Field label="Image description (alt text)" hint="Read aloud by screen readers; also helps SEO"><input className="input" value={edit.f.alt} onChange={(e) => set("alt", e.target.value)} maxLength={160} /></Field>
              <Field label="Sort order" hint="Smaller number shows first"><input className="input" type="number" value={edit.f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></Field>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold">Schedule <span className="font-normal text-gray-400">(optional, handy for Eid / sale campaigns)</span></h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Show from"><input className="input" type="date" value={edit.f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
              <Field label="Hide after"><input className="input" type="date" value={edit.f.endsAt} min={edit.f.startsAt || undefined} onChange={(e) => set("endsAt", e.target.value)} /></Field>
            </div>
            <p className="text-xs text-gray-500">The website refreshes every minute, so a scheduled cover appears or disappears within about a minute of its date.</p>
          </div>
          <Toggle checked={edit.f.active} onChange={(v) => set("active", v)} label="Show on home page" />
        </div>}
      </Modal>
      {node}
    </>
  );
}
