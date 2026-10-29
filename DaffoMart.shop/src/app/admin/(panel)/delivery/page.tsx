"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { taka } from "@/lib/format";
import type { DeliveryZone } from "@/lib/types";

type Form = { name: string; charge: string; freeOver: string; eta: string; sortOrder: string; active: boolean; viaCourier: boolean };
export default function DeliveryPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const { data, setData, loading, error, reload } = useList<DeliveryZone[]>("/api/zones");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const open = (z?: DeliveryZone) => { setErrs({}); setEdit(z ? { id: z.id, f: { name: z.name, charge: String(z.charge), freeOver: String(z.freeOver ?? 0), eta: z.eta ?? "", sortOrder: String(z.sortOrder), active: z.active, viaCourier: !!z.viaCourier } } : { f: { name: "", charge: "60", freeOver: "0", eta: "", sortOrder: String((data?.length ?? 0) + 1), active: true, viaCourier: false } }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const sorted = (l: DeliveryZone[]) => [...l].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const s = await api<DeliveryZone>(edit.id ? `/api/zones/${edit.id}` : "/api/zones", { method: edit.id ? "PUT" : "POST", body: edit.f });
      setData((d) => sorted(edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [...(d ?? []), s])); toast("Delivery area saved"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (z: DeliveryZone) => {
    if (!(await confirm(`Delete delivery area "${z.name}"? Old orders keep their saved area name.`))) return;
    try { await api(`/api/zones/${z.id}`, { method: "DELETE" }); setData((d) => d!.filter((x) => x.id !== z.id)); toast("Delivery area deleted"); } catch (e: any) { toast(e.message, "err"); }
  };
  const quick = async (z: DeliveryZone, active: boolean) => {
    try { const s = await api<DeliveryZone>(`/api/zones/${z.id}`, { method: "PUT", body: { ...z, active } }); setData((d) => d!.map((x) => (x.id === s.id ? s : x))); } catch (e: any) { toast(e.message, "err"); }
  };
  return (
    <>
      <PageHeader title="Delivery areas & charges" subtitle="Customers pick one of these areas at checkout. Charges are applied automatically."><button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add area</button></PageHeader>
      {loading ? <PageLoader /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.length ? <div className="card"><Empty icon="delivery" title="No delivery areas yet" hint="Add at least one area, otherwise customers cannot place orders." action={<button className="btn-primary" onClick={() => open()}>Add area</button>} /></div> : (
        <div className="card overflow-hidden"><div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[640px]">
          <thead className="bg-gray-50"><tr><th className="th">Area</th><th className="th">Delivery charge</th><th className="th">Free delivery over</th><th className="th">Delivery time</th><th className="th">Active</th><th className="th text-right">Actions</th></tr></thead>
          <tbody className="divide-y">{data.map((z) => (
            <tr key={z.id} className="hover:bg-gray-50"><td className="td font-semibold">{z.name}{z.viaCourier && <span className="badge ml-2 bg-sky-100 text-sky-800">🚚 Courier</span>}</td><td className="td">{taka(z.charge)}</td><td className="td text-gray-600">{z.freeOver > 0 ? taka(z.freeOver) : "—"}</td><td className="td text-gray-600">{z.eta || "—"}</td>
              <td className="td"><Toggle checked={z.active} onChange={(v) => quick(z, v)} /></td>
              <td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => open(z)} aria-label="Edit"><Icon name="edit" className="h-4 w-4" /></button><button className="btn-ghost btn-sm text-red-600" onClick={() => del(z)} aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></button></td></tr>))}</tbody></table></div></div>)}
      <p className="mt-3 text-xs text-gray-500">Tip: add areas like “Savar”, “Mirpur”, “Chattogram” with their own charge. Hidden (inactive) areas are not shown to customers.</p>
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit delivery area" : "Add delivery area"}
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area name" error={errs.name} className="sm:col-span-2"><input className="input" value={edit.f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Inside Dhaka" /></Field>
          <Field label="Delivery charge (৳)" error={errs.charge}><input className="input" type="number" min="0" value={edit.f.charge} onChange={(e) => set("charge", e.target.value)} /></Field>
          <Field label="Free delivery over (৳)" hint="0 = never free"><input className="input" type="number" min="0" value={edit.f.freeOver} onChange={(e) => set("freeOver", e.target.value)} /></Field>
          <Field label="Delivery time" hint="Shown to customers, e.g. Same day"><input className="input" value={edit.f.eta} onChange={(e) => set("eta", e.target.value)} /></Field>
          <Field label="Sort order"><input className="input" type="number" value={edit.f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></Field>
          <div className="sm:col-span-2 space-y-3"><Toggle checked={edit.f.viaCourier} onChange={(v) => set("viaCourier", v)} label="Delivered by a courier company (outside Dhaka)" /><p className="-mt-1 text-xs text-gray-500">Orders to this area show up as “needs courier” and you assign Pathao / Steadfast / … from the order. Customers see your courier note at checkout.</p><Toggle checked={edit.f.active} onChange={(v) => set("active", v)} label="Available to customers" /></div>
        </div>}
      </Modal>
      {node}
    </>
  );
}
