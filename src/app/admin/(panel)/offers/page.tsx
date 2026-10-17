"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, ImageUpload, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { fmtDate, taka } from "@/lib/format";
import type { Offer } from "@/lib/types";

type Form = { title: string; description: string; badge: string; image?: string; code: string; discountType: "percent" | "flat"; discountValue: string; minOrder: string; startsAt: string; endsAt: string; active: boolean };
const blank = (): Form => ({ title: "", description: "", badge: "", code: "", discountType: "percent", discountValue: "10", minOrder: "0", startsAt: "", endsAt: "", active: true });
const state = (o: Offer) => { if (!o.active) return "inactive"; const n = Date.now(); if (o.startsAt && new Date(o.startsAt).getTime() > n) return "scheduled"; if (o.endsAt && new Date(o.endsAt).getTime() + 86400000 <= n) return "expired"; return "live"; };

export default function OffersPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const { data, setData, loading, error, reload } = useList<Offer[]>("/api/offers");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const open = (o?: Offer) => { setErrs({}); setEdit(o ? { id: o.id, f: { title: o.title, description: o.description, badge: o.badge, image: o.image, code: o.code ?? "", discountType: o.discountType, discountValue: String(o.discountValue), minOrder: String(o.minOrder), startsAt: o.startsAt ?? "", endsAt: o.endsAt ?? "", active: o.active } } : { f: blank() }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const s = await api<Offer>(edit.id ? `/api/offers/${edit.id}` : "/api/offers", { method: edit.id ? "PUT" : "POST", body: edit.f });
      setData((d) => (edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [s, ...(d ?? [])]));
      toast("Offer saved"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (o: Offer) => { if (!(await confirm(`Delete offer "${o.title}"?`))) return; try { await api(`/api/offers/${o.id}`, { method: "DELETE" }); setData((d) => d!.filter((x) => x.id !== o.id)); toast("Offer deleted"); } catch (e: any) { toast(e.message, "err"); } };
  const f = edit?.f;
  return (
    <>
      <PageHeader title="Offers & Coupons" subtitle="Promotions shown on the home page. Add a coupon code to give customers a discount at checkout."><button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add offer</button></PageHeader>
      {loading ? <PageLoader /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.length ? <div className="card"><Empty icon="offers" title="No offers yet" hint="Create a promotion with an image and an optional coupon code." action={<button className="btn-primary" onClick={() => open()}>Add offer</button>} /></div> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.map((o) => (
            <div key={o.id} className="card flex flex-col overflow-hidden">
              <div className="relative aspect-[16/9] bg-gradient-to-br from-primary to-primary-dark">{o.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={o.image} alt="" className="h-full w-full object-cover" />}
                {o.badge && <span className="absolute left-3 top-3 rounded bg-accent px-2 py-1 text-xs font-bold text-white">{o.badge}</span>}
                {!o.image && <div className="absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-white/90">{o.discountType === "percent" ? `${o.discountValue}% OFF` : `${taka(o.discountValue)} OFF`}</div>}</div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{o.title}</h3><StatusBadge status={state(o)} /></div>
                {o.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{o.description}</p>}
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  {o.code && <p>Code: <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono font-bold text-gray-800">{o.code}</span> · {o.discountType === "percent" ? `${o.discountValue}%` : taka(o.discountValue)} off{o.minOrder > 0 && ` over ${taka(o.minOrder)}`}</p>}
                  {(o.startsAt || o.endsAt) && <p>{fmtDate(o.startsAt)} → {fmtDate(o.endsAt)}</p>}</div>
                <div className="mt-auto flex justify-end pt-3"><button className="btn-ghost btn-sm" onClick={() => open(o)}><Icon name="edit" className="h-4 w-4" />Edit</button><button className="btn-ghost btn-sm text-red-600" onClick={() => del(o)}><Icon name="trash" className="h-4 w-4" /></button></div>
              </div>
            </div>))}
        </div>)}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit offer" : "Add offer"} wide
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save offer</button></>}>
        {f && <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <ImageUpload kind="offer" label="Offer image (optional)" aspect="aspect-[16/9]" value={f.image} onChange={(v) => set("image", v)} />
            <div className="space-y-4"><Field label="Title" error={errs.title}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Weekend Fresh Sale" /></Field>
              <Field label="Description"><textarea className="input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Badge text" hint="Small label, e.g. HOT DEAL"><input className="input" value={f.badge} onChange={(e) => set("badge", e.target.value)} /></Field></div></div>
          <div className="rounded-xl border bg-gray-50 p-4"><p className="mb-3 text-sm font-semibold">Coupon discount <span className="font-normal text-gray-500">(optional — leave code empty for a display-only offer)</span></p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Coupon code" error={errs.code}><input className="input font-mono uppercase" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SAVE10" /></Field>
              <Field label="Minimum order (৳)"><input className="input" type="number" min="0" value={f.minOrder} onChange={(e) => set("minOrder", e.target.value)} /></Field>
              <Field label="Discount type"><select className="input" value={f.discountType} onChange={(e) => set("discountType", e.target.value as any)}><option value="percent">Percentage (%)</option><option value="flat">Fixed amount (৳)</option></select></Field>
              <Field label="Discount value" error={errs.discountValue}><input className="input" type="number" min="0" value={f.discountValue} onChange={(e) => set("discountValue", e.target.value)} /></Field></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts on"><input className="input" type="date" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field><Field label="Ends on (inclusive)"><input className="input" type="date" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Field></div>
          <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Active" />
        </div>}
      </Modal>
      {node}
    </>
  );
}
