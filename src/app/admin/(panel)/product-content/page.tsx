"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorBox, Field, GalleryUpload, ImageUpload, PageHeader, PageLoader, Spinner, Thumb, Toggle, useList, useToast } from "@/components/admin/ui";
import { parseVideoUrl } from "@/lib/productPage";
import type { Product } from "@/lib/types";

type Content = { id: string; name: string; categoryId: string; brand?: string; countryOfOrigin?: string; manufacturer?: string; manufacturerInfo?: string; description: string;
  descSections: { id?: string; title: string; body: string }[]; specs: { id?: string; label: string; value: string }[];
  video: { kind: "upload" | "external"; url: string; poster?: string; title?: string; enabled: boolean } | null; extraImages: string[]; badges: string[]; sameCategoryIds: string[]; recommendedIds: string[]; reviewCount: number; rating: number };

/** Suggested spec labels by kind of product: one click adds the empty rows, empty rows are never saved or shown. */
const PRESETS: Record<string, string[]> = {
  Grocery: ["Net weight", "Shelf life", "Storage", "Ingredients", "Packaging"],
  Electronics: ["Model", "Warranty", "Dimensions", "Weight", "Power", "Technical details"],
  Fashion: ["Material", "Size", "Color", "Fit", "Care instructions"],
  "Home appliance": ["Model", "Warranty", "Dimensions", "Capacity", "Power consumption", "Color"],
  Medicine: ["Generic name", "Strength", "Dosage form", "Pack size", "Storage"],
};
function move<T>(a: T[], i: number, d: number) { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c; }
const Block = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => <section className="card space-y-3 p-5"><div><h2 className="font-bold">{title}</h2>{hint && <p className="text-xs text-gray-500">{hint}</p>}</div>{children}</section>;

function Picker({ title, hint, all, selected, onChange }: { title: string; hint: string; all: Product[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState(""); const byId = new Map(all.map((p) => [p.id, p]));
  const options = all.filter((p) => !selected.includes(p.id) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 8);
  return (
    <Block title={title} hint={hint}>
      <ol className="space-y-1.5">{selected.map((id, i) => { const p = byId.get(id); return (
        <li key={id} className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"><span className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</span><Thumb src={p?.image} emoji={p?.emoji ?? "🛒"} className="h-9 w-9" /><span className="min-w-0 flex-1 truncate">{p?.name ?? "(removed product)"}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(move(selected, i, -1))} disabled={i === 0} aria-label="Move up">▲</button><button type="button" className="btn-ghost btn-sm" onClick={() => onChange(move(selected, i, 1))} disabled={i === selected.length - 1} aria-label="Move down">▼</button><button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => onChange(selected.filter((x) => x !== id))} aria-label="Remove">✕</button></li>); })}</ol>
      <input className="input" placeholder="Search products to add…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${title}`} />
      {options.length > 0 ? <ul className="max-h-52 divide-y overflow-auto rounded-lg border bg-white text-sm">{options.map((p) => <li key={p.id}><button type="button" className="flex w-full items-center gap-2 p-2 text-left hover:bg-gray-50" onClick={() => { onChange([...selected, p.id]); setQ(""); }}><Thumb src={p.image} emoji={p.emoji} className="h-8 w-8" /><span className="truncate">{p.name}</span><span className="ml-auto text-xs text-primary">+ Add</span></button></li>)}</ul> : <p className="text-xs text-gray-500">No matching products.</p>}
    </Block>
  );
}

export default function ProductContentPage() {
  const toast = useToast(); const sp = useSearchParams();
  const prods = useList<{ items: Product[] }>("/api/products?limit=500");
  const [id, setId] = useState(sp.get("id") || ""); const [q, setQ] = useState("");
  const [c, setC] = useState<Content | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false);
  const [vmode, setVmode] = useState<"bucket" | "local" | "none">("none"); const [upBusy, setUpBusy] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const all = prods.data?.items ?? [];

  useEffect(() => { if (!id) return; setC(null); setErr(""); setDirty(false); api<Content>(`/api/admin/product-content/${id}`).then(setC).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { api<{ mode: "bucket" | "local" | "none" }>("/api/admin/product-video").then((r) => setVmode(r.mode)).catch(() => {}); }, []);
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);
  const set = (patch: Partial<Content>) => { setC((x) => (x ? { ...x, ...patch } : x)); setDirty(true); };
  const list = useMemo(() => all.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase())).slice(0, 60), [all, q]);
  const sameCat = all.filter((p) => c && p.categoryId === c.categoryId && p.id !== c.id && p.active);
  const otherCat = all.filter((p) => c && p.categoryId !== c.categoryId && p.active);

  const save = async () => {
    if (!c) return; setBusy(true);
    try { const r = await api<Content>(`/api/admin/product-content/${c.id}`, { method: "PUT", body: { brand: c.brand, countryOfOrigin: c.countryOfOrigin, manufacturer: c.manufacturer, manufacturerInfo: c.manufacturerInfo, descSections: c.descSections, specs: c.specs, video: c.video, extraImages: c.extraImages, badges: c.badges, sameCategoryIds: c.sameCategoryIds, recommendedIds: c.recommendedIds } }); setC(r); setDirty(false); toast("Saved. The product page is updated."); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const upload = async (file: File | undefined) => {
    if (!file || !c) return; setUpBusy(true);
    try {
      if (vmode === "bucket") {
        const init = await api<{ uploadUrl: string; name: string; headers: Record<string, string> }>("/api/admin/product-video", { method: "POST", body: { action: "init", contentType: file.type, size: file.size } });
        const put = await fetch(init.uploadUrl, { method: "PUT", headers: init.headers, body: file }); if (!put.ok) throw new Error("The upload to storage failed. Please try again.");
        const fin = await api<{ url: string }>("/api/admin/product-video", { method: "POST", body: { action: "finish", name: init.name } });
        set({ video: { kind: "upload", url: fin.url, poster: c.video?.poster, title: c.video?.title, enabled: true } });
      } else {
        const fd = new FormData(); fd.set("file", file); const r = await fetch("/api/admin/product-video", { method: "POST", body: fd }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error || "Upload failed");
        set({ video: { kind: "upload", url: (j.data ?? j).url, poster: c.video?.poster, title: c.video?.title, enabled: true } });
      }
      toast("Video uploaded. Press Save to publish it on the product page.");
    } catch (e: any) { toast(e.message, "err"); } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const v = c?.video; const extOk = v?.kind === "external" && v.url ? !!parseVideoUrl(v.url) : true;

  return (
    <>
      <PageHeader title="Product Content" subtitle="Description sections, specifications, video, extra photos, badges and recommendations for each product page." />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="card h-fit p-3 lg:sticky lg:top-20"><input className="input mb-2" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          <ul className="max-h-[70vh] space-y-1 overflow-auto">{list.map((p) => <li key={p.id}><button type="button" onClick={async () => { if (dirty && !window.confirm("You have unsaved changes. Switch product without saving?")) return; setId(p.id); }} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm ${id === p.id ? "bg-primary-soft font-semibold text-primary" : "hover:bg-gray-50"}`}><Thumb src={p.image} emoji={p.emoji} className="h-9 w-9" /><span className="truncate">{p.name}</span></button></li>)}</ul></aside>
        <div className="min-w-0 space-y-4">
          {!id ? <p className="card p-8 text-center text-sm text-gray-500">Choose a product on the left.</p> : err ? <ErrorBox msg={err} retry={() => setId(id)} /> : !c ? <PageLoader /> : (<>
            <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3 shadow-card"><p className="min-w-0 truncate font-bold">{c.name}{dirty && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Unsaved</span>}</p><div className="flex gap-2"><a className="btn-outline btn-sm" href={`/admin/product-page`}>Page builder</a><button className="btn-primary" onClick={save} disabled={busy || !dirty}>{busy && <Spinner className="h-4 w-4" />}Save</button></div></div>

            <Block title="Brand & manufacturer">
              <div className="grid gap-3 sm:grid-cols-3"><Field label="Brand"><input className="input" value={c.brand ?? ""} maxLength={80} onChange={(e) => set({ brand: e.target.value })} /></Field><Field label="Manufacturer"><input className="input" value={c.manufacturer ?? ""} maxLength={120} onChange={(e) => set({ manufacturer: e.target.value })} /></Field><Field label="Country of origin"><input className="input" value={c.countryOfOrigin ?? ""} maxLength={60} onChange={(e) => set({ countryOfOrigin: e.target.value })} /></Field></div>
              <Field label="About the manufacturer (optional)"><textarea className="input" rows={3} maxLength={1200} value={c.manufacturerInfo ?? ""} onChange={(e) => set({ manufacturerInfo: e.target.value })} /></Field>
            </Block>

            <Block title="Description sections" hint="Split the description into titled parts, e.g. Features, Benefits, How to use, Important information. Shown in this order.">
              {c.descSections.length === 0 && c.description && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">The product currently shows its old single description. Adding sections here replaces it on the page. <button type="button" className="font-semibold underline" onClick={() => set({ descSections: [{ title: "Description", body: c.description }] })}>Convert it into the first section</button></p>}
              <ol className="space-y-3">{c.descSections.map((d, i) => (
                <li key={d.id ?? i} className="space-y-2 rounded-xl border bg-gray-50 p-3">
                  <div className="flex items-center gap-2"><input className="input" placeholder="Section title (e.g. Features)" value={d.title} maxLength={80} onChange={(e) => set({ descSections: c.descSections.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)) })} aria-label="Section title" />
                    <button type="button" className="btn-ghost btn-sm" disabled={i === 0} onClick={() => set({ descSections: move(c.descSections, i, -1) })} aria-label="Move up">▲</button><button type="button" className="btn-ghost btn-sm" disabled={i === c.descSections.length - 1} onClick={() => set({ descSections: move(c.descSections, i, 1) })} aria-label="Move down">▼</button><button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => set({ descSections: c.descSections.filter((_, n) => n !== i) })} aria-label="Remove section">✕</button></div>
                  <textarea className="input" rows={4} maxLength={3000} placeholder="Text…" value={d.body} onChange={(e) => set({ descSections: c.descSections.map((x, n) => (n === i ? { ...x, body: e.target.value } : x)) })} aria-label="Section text" /></li>))}</ol>
              <div className="flex flex-wrap gap-2">{["Features", "Benefits", "How to use", "Important information"].map((t) => <button key={t} type="button" className="btn-outline btn-sm" disabled={c.descSections.length >= 12} onClick={() => set({ descSections: [...c.descSections, { title: t, body: "" }] })}>+ {t}</button>)}<button type="button" className="btn-outline btn-sm" disabled={c.descSections.length >= 12} onClick={() => set({ descSections: [...c.descSections, { title: "", body: "" }] })}>+ Blank section</button></div>
            </Block>

            <Block title="Specifications" hint="Only rows with both a name and a value appear on the page.">
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-gray-500">Quick add:</span>{Object.entries(PRESETS).map(([k, labels]) => <button key={k} type="button" className="btn-outline btn-sm" onClick={() => { const have = new Set(c.specs.map((s) => s.label.toLowerCase())); const add = labels.filter((l) => !have.has(l.toLowerCase())).map((label) => ({ label, value: "" })); set({ specs: [...c.specs, ...add].slice(0, 40) }); }}>{k}</button>)}</div>
              <ul className="space-y-2">{c.specs.map((s, i) => (
                <li key={s.id ?? i} className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2"><input className="input" placeholder="Name (e.g. Material)" value={s.label} maxLength={60} onChange={(e) => set({ specs: c.specs.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)) })} aria-label="Specification name" /><input className="input" placeholder="Value" value={s.value} maxLength={200} onChange={(e) => set({ specs: c.specs.map((x, n) => (n === i ? { ...x, value: e.target.value } : x)) })} aria-label="Specification value" />
                  <div className="flex"><button type="button" className="btn-ghost btn-sm" disabled={i === 0} onClick={() => set({ specs: move(c.specs, i, -1) })} aria-label="Move up">▲</button><button type="button" className="btn-ghost btn-sm" disabled={i === c.specs.length - 1} onClick={() => set({ specs: move(c.specs, i, 1) })} aria-label="Move down">▼</button><button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => set({ specs: c.specs.filter((_, n) => n !== i) })} aria-label="Remove">✕</button></div></li>))}</ul>
              <button type="button" className="btn-outline btn-sm" disabled={c.specs.length >= 40} onClick={() => set({ specs: [...c.specs, { label: "", value: "" }] })}>+ Add specification</button>
            </Block>

            <Block title="Promotional video" hint="Paste a YouTube / Vimeo / .mp4 link, or upload a video. Turn it off or remove it any time; with no video the section disappears.">
              <div className="flex flex-wrap items-center gap-4"><Toggle checked={v?.enabled ?? false} disabled={!v} onChange={(en) => v && set({ video: { ...v, enabled: en } })} label="Show video" /><div className="inline-flex overflow-hidden rounded-lg border text-sm" role="group" aria-label="Video source">{(["external", "upload"] as const).map((k) => <button key={k} type="button" aria-pressed={v?.kind === k} onClick={() => set({ video: { kind: k, url: v?.kind === k ? v.url : "", poster: v?.poster, title: v?.title, enabled: v?.enabled ?? true } })} className={`px-3 py-1.5 font-semibold ${v?.kind === k ? "bg-primary text-white" : "bg-white hover:bg-gray-50"}`}>{k === "external" ? "Link" : "Upload"}</button>)}</div>{v && <button type="button" className="text-sm font-semibold text-red-600 underline" onClick={() => set({ video: null })}>Remove video</button>}</div>
              {v?.kind === "external" && <Field label="Video link" error={!extOk ? "Use a YouTube, Vimeo or direct https .mp4 / .webm link" : undefined}><input className="input" value={v.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => set({ video: { ...v, url: e.target.value } })} /></Field>}
              {v?.kind === "upload" && <div className="space-y-2">
                {vmode === "none" ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Uploading videos needs Firebase Storage (a Blaze plan with <code>FIREBASE_STORAGE_BUCKET</code> set). Until then, use the Link option.</p> : <>
                  <input ref={fileRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => upload(e.target.files?.[0])} />
                  <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()} disabled={upBusy}>{upBusy && <Spinner className="h-4 w-4" />}{v.url ? "Replace video file" : "Choose video file"}</button>
                  <p className="text-xs text-gray-500">MP4 or WebM, {vmode === "bucket" ? "up to 60 MB" : "up to 4 MB (local development)"}.</p></>}
                {v.url && <p className="truncate text-xs text-gray-500">Current file: {v.url}</p>}</div>}
              {v && <div className="grid gap-3 sm:grid-cols-2"><ImageUpload kind="product" label="Video thumbnail (optional)" aspect="aspect-video" value={v.poster} onChange={(u) => set({ video: { ...v, poster: u || undefined } })} /><Field label="Video title (optional)"><input className="input" value={v.title ?? ""} maxLength={100} onChange={(e) => set({ video: { ...v, title: e.target.value } })} /></Field></div>}
            </Block>

            <Block title="Additional product images" hint="Extra angles and close-ups for the gallery section. Hover a photo to move or remove it.">
              <GalleryUpload value={c.extraImages} onChange={(x) => set({ extraImages: x })} max={12} />
            </Block>

            <Block title="Card badges" hint="Up to 3 short promotional labels shown on the product card and page (e.g. Eid special, Imported)."><div className="flex flex-wrap items-center gap-2">{c.badges.map((b, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-sm font-semibold text-primary">{b}<button type="button" className="rounded-full px-1.5 hover:bg-white" onClick={() => set({ badges: c.badges.filter((_, n) => n !== i) })} aria-label={`Remove badge ${b}`}>✕</button></span>)}
              {c.badges.length < 3 && <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.namedItem("b") as HTMLInputElement; const t = f.value.trim(); if (t) { set({ badges: [...c.badges, t.slice(0, 24)] }); f.value = ""; } }} className="flex gap-2"><input name="b" className="input w-44" maxLength={24} placeholder="New badge" aria-label="New badge" /><button className="btn-outline btn-sm">Add</button></form>}</div></Block>

            <Picker title="Same category products" hint="Hand-picked products from this product's category, in the order you choose. If you pick none, the page shows the first products of the category." all={sameCat} selected={c.sameCategoryIds} onChange={(x) => set({ sameCategoryIds: x })} />
            <Picker title="Other category / recommended products" hint="Products from other categories. A product can be in only one of the two lists." all={otherCat} selected={c.recommendedIds} onChange={(x) => set({ recommendedIds: x })} />
          </>)}
        </div>
      </div>
    </>
  );
}
