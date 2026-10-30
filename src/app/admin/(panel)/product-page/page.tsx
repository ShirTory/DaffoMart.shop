"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, PageHeader, PageLoader, Spinner, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { newSection, SECTION_IDS, SECTION_META, validateLayout, type PageLayout, type SectionConfig, type SectionId } from "@/lib/productPage";
import type { Product } from "@/lib/types";

type View = { scope: string; hasDraft: boolean; enabled: boolean; hasPublished: boolean; historyCount: number; version: number; updatedAt: string | null; updatedBy: string | null; editing: PageLayout; live: PageLayout; globalLive: PageLayout; defaults: PageLayout; overrides: string[] };
const DEVICES = { desktop: { w: 1200, label: "Desktop" }, tablet: { w: 820, label: "Tablet" }, mobile: { w: 390, label: "Mobile" } } as const;
type Device = keyof typeof DEVICES;
const same = (a: PageLayout, b: PageLayout) => JSON.stringify(a) === JSON.stringify(b);

export default function ProductPageBuilder() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const prods = useList<{ items: Product[] }>("/api/products?limit=500");
  const [scope, setScope] = useState("global");
  const [view, setView] = useState<View | null>(null); const [loadErr, setLoadErr] = useState("");
  const [layout, setLayout] = useState<PageLayout | null>(null); const [saved, setSaved] = useState<PageLayout | null>(null);
  const [busy, setBusy] = useState(""); const [open, setOpen] = useState<SectionId | null>(null);
  const [previewId, setPreviewId] = useState(""); const [device, setDevice] = useState<Device>("desktop");
  const [drag, setDrag] = useState<number | null>(null); const [over, setOver] = useState<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null); const box = useRef<HTMLDivElement>(null); const [boxW, setBoxW] = useState(600);
  const [frameKey, setFrameKey] = useState(0);

  const load = useCallback(async (sc: string) => {
    setLoadErr("");
    try { const v = await api<View>(`/api/admin/product-page?scope=${encodeURIComponent(sc)}`); setView(v); setLayout(structuredClone(v.editing)); setSaved(structuredClone(v.editing)); }
    catch (e: any) { setLoadErr(e.message); }
  }, []);
  useEffect(() => { load(scope); }, [scope, load]);
  const products = prods.data?.items ?? [];
  useEffect(() => { if (!previewId && products.length) setPreviewId((scope !== "global" && products.some((p) => p.id === scope) ? scope : products[0].id)); }, [products, previewId, scope]);

  const dirty = !!layout && !!saved && !same(layout, saved);
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);

  // live preview: push every edit into the iframe (the preview page validates it and keeps the last valid layout)
  const push = useCallback(() => { if (layout) frame.current?.contentWindow?.postMessage({ type: "pp-layout", layout }, window.location.origin); }, [layout]);
  useEffect(() => { push(); }, [push]);
  useEffect(() => { const on = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === "pp-ready") push(); }; window.addEventListener("message", on); return () => window.removeEventListener("message", on); }, [push]);
  useEffect(() => { const el = box.current; if (!el || typeof ResizeObserver === "undefined") return; const ro = new ResizeObserver(() => setBoxW(el.clientWidth)); ro.observe(el); setBoxW(el.clientWidth); return () => ro.disconnect(); }, []);

  const check = useMemo(() => (layout ? validateLayout(layout) : null), [layout]);
  const errors = check && !check.ok ? check.errors : [];
  const customizing = scope !== "global" && view && !view.enabled && !view.hasDraft && layout && same(layout, saved ?? layout) && !view.hasPublished;
  void customizing;

  const changeScope = async (next: string) => {
    if (dirty && !(await confirm("You have unsaved changes. Leave without saving?"))) return;
    setScope(next); setView(null); setLayout(null);
    if (next !== "global") setPreviewId(next);
  };
  const upd = (i: number, patch: Partial<SectionConfig>) => setLayout((l) => (l ? { sections: l.sections.map((s, n) => (n === i ? { ...s, ...patch } : s)) } : l));
  const move = (from: number, to: number) => setLayout((l) => { if (!l || to < 0 || to >= l.sections.length || from === to) return l; const a = [...l.sections]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return { sections: a }; });
  const remove = (i: number) => setLayout((l) => (l ? { sections: l.sections.filter((_, n) => n !== i) } : l));
  const addable = SECTION_IDS.filter((id) => !layout?.sections.some((s) => s.id === id));

  const act = async (action: string, extra: Record<string, unknown> = {}, ok?: string) => {
    setBusy(action);
    try {
      const v = await api<View>("/api/admin/product-page", { method: "POST", body: { scope, action, ...extra } });
      setView(v); setLayout(structuredClone(v.editing)); setSaved(structuredClone(v.editing)); setFrameKey((k) => k + 1); toast(ok || "Done");
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(""); }
  };
  const isProduct = scope !== "global"; const usingOverride = isProduct && view?.enabled;
  const scale = Math.min(1, (boxW - 2) / DEVICES[device].w);
  const scopeName = isProduct ? products.find((p) => p.id === scope)?.name ?? "this product" : "all products";

  return (
    <>
      <PageHeader title="Product Page Builder" subtitle="Arrange, show/hide and rename the sections of the product page. Changes stay a draft until you publish them." />
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4">
        <label className="min-w-[240px] flex-1 text-sm font-medium">Layout for
          <select className="input mt-1" value={scope} onChange={(e) => changeScope(e.target.value)}>
            <option value="global">Global default (all products)</option>
            <optgroup label="Single product (override)">{products.map((p) => <option key={p.id} value={p.id}>{p.name}{view?.overrides.includes(p.id) ? "  ● custom" : ""}</option>)}</optgroup>
          </select></label>
        <div className="text-xs text-gray-500">{view ? <>Version {view.version}{view.updatedBy ? ` · saved by ${view.updatedBy}` : ""}{view.hasDraft ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Draft saved</span> : null}{dirty ? <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">Unsaved changes</span> : null}</> : null}</div>
      </div>

      {loadErr ? <ErrorBox msg={loadErr} retry={() => load(scope)} /> : !view || !layout ? <PageLoader /> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(340px,440px)_1fr]">
          <div className="space-y-3">
            {isProduct && !usingOverride && (
              <div className="rounded-2xl border border-dashed bg-primary-soft p-4 text-sm">
                <p><b>{scopeName}</b> currently follows the global layout. Editing below creates a custom layout just for this product; the global layout is not changed.</p>
              </div>)}
            {usingOverride && <div className="flex items-center justify-between gap-2 rounded-2xl border bg-emerald-50 p-3 text-sm text-emerald-900"><span>This product has its <b>own layout</b>.</span><button className="btn-outline btn-sm" disabled={!!busy} onClick={async () => { if (await confirm("Stop using the custom layout and follow the global layout again?")) act("reset", {}, "Now following the global layout"); }}>Use global layout</button></div>}

            <ol className="space-y-2" aria-label="Page sections">
              {layout.sections.map((s, i) => {
                const meta = SECTION_META[s.id]; const isOpen = open === s.id;
                return (
                  <li key={s.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver((o) => (o === i ? null : o))} onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }} onDragEnd={() => { setDrag(null); setOver(null); }}
                    className={`rounded-xl border bg-white ${over === i && drag !== null && drag !== i ? "border-primary ring-2 ring-primary/30" : ""} ${drag === i ? "opacity-50" : ""} ${s.enabled ? "" : "bg-gray-50"}`} data-section-row={s.id}>
                    <div className="flex items-center gap-2 p-3">
                      <span className="cursor-grab select-none px-1 text-lg text-gray-400" title="Drag to reorder" aria-hidden>⠿</span>
                      <span className="w-6 shrink-0 text-center text-xs font-bold text-gray-400">{String(i + 1).padStart(2, "0")}</span>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}><p className={`truncate text-sm font-semibold ${s.enabled ? "" : "text-gray-400 line-through"}`}>{meta.label}</p><p className="truncate text-xs text-gray-500">{s.title}</p></button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${meta.label} up`}>▲</button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, i + 1)} disabled={i === layout.sections.length - 1} aria-label={`Move ${meta.label} down`}>▼</button>
                        <span title={s.id === "overview" ? "The overview holds the price and Add to cart, so it always stays visible" : undefined}><Toggle checked={s.enabled} onChange={(v) => upd(i, { enabled: v })} disabled={s.id === "overview"} /></span>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="space-y-3 border-t bg-gray-50 p-3 text-sm">
                        <p className="text-xs text-gray-500">{meta.hint}</p>
                        <label className="block font-medium">Title<input className="input mt-1" value={s.title} maxLength={80} onChange={(e) => upd(i, { title: e.target.value })} /></label>
                        <label className="block font-medium">Subtitle <span className="font-normal text-gray-400">(optional)</span><input className="input mt-1" value={s.subtitle} maxLength={160} onChange={(e) => upd(i, { subtitle: e.target.value })} /></label>
                        {meta.reco && <div className="grid grid-cols-2 gap-3">
                          <label className="block font-medium">Display<select className="input mt-1" value={s.display ?? "grid"} onChange={(e) => upd(i, { display: e.target.value as "grid" | "carousel" })}><option value="grid">Grid</option><option value="carousel">Carousel</option></select></label>
                          <label className="block font-medium">Products shown<input className="input mt-1" type="number" min={1} max={24} value={s.limit ?? 5} onChange={(e) => upd(i, { limit: Number(e.target.value) })} /></label></div>}
                        {meta.optional && <button type="button" className="text-xs font-semibold text-red-600 underline" onClick={() => { remove(i); setOpen(null); }}>Remove this section</button>}
                      </div>)}
                  </li>);
              })}
            </ol>
            {addable.length > 0 && <div className="flex items-center gap-2"><select className="input" id="add-section" defaultValue="" onChange={(e) => { const id = e.target.value as SectionId; if (id) { setLayout((l) => (l ? { sections: [...l.sections, newSection(id)] } : l)); setOpen(id); } e.target.value = ""; }}><option value="">+ Add a section…</option>{addable.map((id) => <option key={id} value={id}>{SECTION_META[id].label}</option>)}</select></div>}

            {errors.length > 0 && <ul className="space-y-1 rounded-xl bg-red-50 p-3 text-xs text-red-700" role="alert">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}

            <div className="sticky bottom-2 z-10 space-y-2 rounded-2xl border bg-white p-3 shadow-pop">
              <div className="flex flex-wrap gap-2">
                <button className="btn-outline" disabled={!!busy || errors.length > 0 || !dirty} onClick={() => act("saveDraft", { layout }, "Draft saved")}>{busy === "saveDraft" && <Spinner className="h-4 w-4" />}Save draft</button>
                <button className="btn-primary" disabled={!!busy || errors.length > 0 || (!dirty && !view.hasDraft && (usingOverride || !isProduct) && same(layout, view.live))} onClick={async () => { if (!(await confirm(`Publish this layout for ${scopeName}? Customers see it right away.`))) return; act("publish", { layout }, "Published"); }}>{busy === "publish" && <Spinner className="h-4 w-4" />}Publish</button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <button className="font-semibold text-gray-600 underline disabled:opacity-40" disabled={!!busy || (!dirty && !view.hasDraft)} onClick={async () => { if (await confirm("Discard the draft and go back to the live layout?")) act("discardDraft", {}, "Draft discarded"); }}>Discard draft</button>
                <button className="font-semibold text-gray-600 underline disabled:opacity-40" disabled={!!busy || view.historyCount === 0} onClick={async () => { if (await confirm("Restore the previous published version? The current live version will be replaced.")) act("rollback", {}, "Previous version restored"); }}>Restore previous version{view.historyCount ? ` (${view.historyCount})` : ""}</button>
                <button className="font-semibold text-gray-600 underline disabled:opacity-40" disabled={!!busy} onClick={async () => { if (await confirm(isProduct ? "Stop using a custom layout for this product?" : "Reset the global layout to the shop default order and publish it?")) act("reset", {}, isProduct ? "Now following the global layout" : "Reset to default and published"); }}>{isProduct ? "Use global layout" : "Reset to default"}</button>
                <button className="font-semibold text-gray-600 underline" onClick={() => { setLayout(structuredClone(view.defaults)); toast("Default order loaded as a draft. Publish to apply."); }}>Load default order</button>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="min-w-[200px] flex-1 text-sm font-medium"><span className="sr-only">Preview product</span><select className="input" value={previewId} onChange={(e) => setPreviewId(e.target.value)} aria-label="Preview product">{products.map((p) => <option key={p.id} value={p.id}>Preview: {p.name}</option>)}</select></label>
              <div className="inline-flex overflow-hidden rounded-xl border bg-white" role="group" aria-label="Preview size">{(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`px-3 py-2 text-sm font-semibold ${device === d ? "bg-primary text-white" : "hover:bg-gray-50"}`}>{DEVICES[d].label}</button>)}</div>
            </div>
            <div ref={box} className="overflow-hidden rounded-2xl border bg-gray-100" style={{ height: 820 * scale + 2 }}>
              {previewId ? <iframe key={`${previewId}-${scope}-${frameKey}`} ref={frame} title="Product page preview" src={`/preview/product/${previewId}?scope=${encodeURIComponent(scope)}`} onLoad={push} style={{ width: DEVICES[device].w, height: 820, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, background: "white", display: "block" }} /> : <p className="p-8 text-center text-sm text-gray-500">Add a product to preview the page.</p>}
            </div>
            <p className="mt-2 text-xs text-gray-500">The preview is the real product page, showing your unpublished edits. Sections that have no content for the chosen product are marked &quot;hidden on the live page&quot;.</p>
          </div>
        </div>)}
      {node}
    </>
  );
}
