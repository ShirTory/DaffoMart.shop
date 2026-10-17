"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, ImageUpload, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import type { Banner } from "@/lib/types";

type Form = { title: string; subtitle: string; image?: string; mobileImage?: string; ctaLabel: string; ctaHref: string; active: boolean; sortOrder: string };
export default function CoversPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const { data, setData, loading, error, reload } = useList<Banner[]>("/api/banners");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const open = (b?: Banner) => { setErrs({}); setEdit(b ? { id: b.id, f: { title: b.title, subtitle: b.subtitle, image: b.image, mobileImage: b.mobileImage, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref, active: b.active, sortOrder: String(b.sortOrder) } } : { f: { title: "", subtitle: "", ctaLabel: "Shop now", ctaHref: "/products", active: true, sortOrder: String((data?.length ?? 0) + 1) } }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const s = await api<Banner>(edit.id ? `/api/banners/${edit.id}` : "/api/banners", { method: edit.id ? "PUT" : "POST", body: { ...edit.f, image: edit.f.image ?? "" } });
      setData((d) => (edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [...(d ?? []), s]).sort((a, b) => a.sortOrder - b.sortOrder));
      toast("Cover image saved"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (b: Banner) => { if (!(await confirm("Delete this cover image?"))) return; try { await api(`/api/banners/${b.id}`, { method: "DELETE" }); setData((d) => d!.filter((x) => x.id !== b.id)); toast("Deleted"); } catch (e: any) { toast(e.message, "err"); } };
  const flip = async (b: Banner) => { try { const s = await api<Banner>(`/api/banners/${b.id}`, { method: "PUT", body: { ...b, active: !b.active } }); setData((d) => d!.map((x) => (x.id === s.id ? s : x))); } catch (e: any) { toast(e.message, "err"); } };

  return (
    <>
      <PageHeader title="Cover Images" subtitle="Slides shown at the top of your home page. If none are active, a default banner is shown."><button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add cover image</button></PageHeader>
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Recommended size: <b>1920 × 600 px</b> (wide). Keep important text near the centre. You can add a separate square-ish image for phones.</div>
      {loading ? <PageLoader /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.length ? <div className="card"><Empty icon="covers" title="No cover images yet" hint="Upload a wide image to show a slider on your home page." action={<button className="btn-primary" onClick={() => open()}>Add cover image</button>} /></div> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.map((b) => (
            <div key={b.id} className="card overflow-hidden">
              <div className="relative aspect-[16/5] bg-gray-100">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={b.image} alt="" className="h-full w-full object-cover" />
                {(b.title || b.subtitle) && <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/55 to-transparent p-5 text-white"><p className="text-lg font-bold">{b.title}</p><p className="text-sm text-white/85">{b.subtitle}</p></div>}</div>
              <div className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><Toggle checked={b.active} onChange={() => flip(b)} /><StatusBadge status={b.active ? "active" : "inactive"} label={b.active ? "Showing" : "Hidden"} /><span className="text-xs text-gray-400">Order #{b.sortOrder}</span></div>
                <div><button className="btn-ghost btn-sm" onClick={() => open(b)}><Icon name="edit" className="h-4 w-4" />Edit</button><button className="btn-ghost btn-sm text-red-600" onClick={() => del(b)}><Icon name="trash" className="h-4 w-4" /></button></div></div>
            </div>))}
        </div>)}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit cover image" : "Add cover image"} wide
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && <div className="space-y-4">
          <ImageUpload kind="banner" label="Cover image (desktop)" aspect="aspect-[16/5]" value={edit.f.image} onChange={(v) => set("image", v)} hint="Wide image, 1920 × 600 px recommended" />
          {errs.image && <p className="text-xs text-red-600">{errs.image}</p>}
          <div className="max-w-xs"><ImageUpload kind="banner" label="Mobile image (optional)" aspect="aspect-[4/3]" value={edit.f.mobileImage} onChange={(v) => set("mobileImage", v)} hint="e.g. 1000 × 750 px" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Headline (optional)"><input className="input" value={edit.f.title} onChange={(e) => set("title", e.target.value)} placeholder="Fresh groceries, delivered fast" /></Field>
            <Field label="Sub-headline (optional)"><input className="input" value={edit.f.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></Field>
            <Field label="Button text"><input className="input" value={edit.f.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Shop now" /></Field>
            <Field label="Button link" hint="e.g. /products or /products?cat=fruit"><input className="input" value={edit.f.ctaHref} onChange={(e) => set("ctaHref", e.target.value)} /></Field>
            <Field label="Sort order"><input className="input" type="number" value={edit.f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></Field>
          </div>
          <Toggle checked={edit.f.active} onChange={(v) => set("active", v)} label="Show on home page" />
        </div>}
      </Modal>
      {node}
    </>
  );
}
