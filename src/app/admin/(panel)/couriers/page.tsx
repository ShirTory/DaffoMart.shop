"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { taka } from "@/lib/format";
import type { Courier } from "@/lib/types";

type Form = { name: string; phone: string; trackingUrl: string; note: string; charge: string; sortOrder: string; active: boolean };
const PRESETS: { name: string; url: string }[] = [
  { name: "Pathao Courier", url: "https://merchant.pathao.com/tracking?consignment_id={tracking}" },
  { name: "Steadfast Courier", url: "https://steadfast.com.bd/t/{tracking}" },
  { name: "RedX", url: "https://redx.com.bd/track-global-parcel/?trackingId={tracking}" },
  { name: "Sundarban Courier", url: "" }, { name: "SA Paribahan", url: "" }, { name: "Janani Express", url: "" },
];

export default function CouriersPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const { data, setData, loading, error, reload } = useList<Courier[]>("/api/couriers");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const open = (c?: Courier) => { setErrs({}); setEdit({ id: c?.id, f: c ? { name: c.name, phone: c.phone, trackingUrl: c.trackingUrl ?? "", note: c.note ?? (c as { notes?: string }).notes ?? "", charge: String(c.charge ?? 0), sortOrder: String(c.sortOrder ?? 0), active: c.active } : { name: "", phone: "", trackingUrl: "", note: "", charge: "0", sortOrder: String((data?.length ?? 0) + 1), active: true } }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const s = await api<Courier>(edit.id ? `/api/couriers/${edit.id}` : "/api/couriers", { method: edit.id ? "PUT" : "POST", body: edit.f });
      setData((d) => (edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [...(d ?? []), s]).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))); toast("Courier saved"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (c: Courier) => { if (!(await confirm(`Delete courier "${c.name}"?`))) return; try { await api(`/api/couriers/${c.id}`, { method: "DELETE" }); setData((d) => d!.filter((x) => x.id !== c.id)); toast("Courier deleted"); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <>
      <PageHeader title="Courier Services" subtitle="Companies you use for deliveries outside Dhaka. Assign one to an order from Orders → open order.">
        <button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add courier</button>
      </PageHeader>
      <p className="mb-4 rounded-xl bg-primary-soft p-3 text-sm text-primary-dark">Mark your “Outside Dhaka” area as <b>delivered by courier</b> in <a href="/admin/delivery" className="font-semibold underline">Delivery Areas</a> so those orders show up as “needs courier” on the Operations page and customers see the courier note at checkout.</p>
      {loading ? <PageLoader /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.length ? <Empty icon="delivery" title="No courier added yet" hint="Add Pathao, Steadfast, RedX, Sundarban… whichever you use." action={<button className="btn-primary" onClick={() => open()}>Add courier</button>} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{c.name}</p>{c.phone && <a href={`tel:${c.phone}`} className="text-xs text-primary">{c.phone}</a>}</div><StatusBadge status={c.active ? "active" : "inactive"} label={c.active ? "Active" : "Off"} /></div>
              {c.note && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{c.note}</p>}
              <p className="mt-2 text-xs text-gray-500">{(c.charge ?? 0) > 0 ? `Usual charge ${taka(c.charge)}` : "No default charge"} · {c.trackingUrl ? "Tracking link set" : "No tracking link"}</p>
              <div className="mt-3 flex gap-1"><button className="btn-outline btn-sm" onClick={() => open(c)}><Icon name="edit" className="h-4 w-4" />Edit</button><button className="btn-ghost btn-sm text-red-600" onClick={() => del(c)}><Icon name="trash" className="h-4 w-4" /></button></div>
            </div>))}
        </div>)}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit courier" : "Add courier"} footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && (
          <div className="space-y-4">
            {!edit.id && <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.name} type="button" className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-primary-soft" onClick={() => { set("name", p.name); set("trackingUrl", p.url); }}>{p.name}</button>)}</div>}
            <Field label="Courier name" error={errs.name}><input className="input" value={edit.f.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Hotline / phone" error={errs.phone}><input className="input" value={edit.f.phone} onChange={(e) => set("phone", e.target.value)} /></Field><Field label="Usual charge (৳)" hint="For your reference"><input className="input" type="number" min="0" value={edit.f.charge} onChange={(e) => set("charge", e.target.value)} /></Field></div>
            <Field label="Tracking link" hint="Use {tracking} where the tracking number goes. Check the courier's own tracking page for the exact link." error={errs.trackingUrl}><input className="input" value={edit.f.trackingUrl} placeholder="https://courier.com/track?no={tracking}" onChange={(e) => set("trackingUrl", e.target.value)} /></Field>
            <Field label="Note"><textarea className="input min-h-[64px]" value={edit.f.note} onChange={(e) => set("note", e.target.value)} placeholder="Pickup time, coverage, contact person…" /></Field>
            <Toggle checked={edit.f.active} onChange={(v) => set("active", v)} label="Active (can be assigned to orders)" />
          </div>)}
      </Modal>
      {node}
    </>
  );
}
