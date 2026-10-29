"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, Icon, Modal, PageHeader, PageLoader, Spinner, useConfirm, useToast } from "@/components/admin/ui";
import { fmtDate, fmtDateTime, statusLabel, taka } from "@/lib/format";
import { waNumber } from "@/lib/phone";
import type { Customer, CustomerFollowUp } from "@/lib/types";

type Row = Customer & { segment: string };
type List = { items: Row[]; total: number; matched: number; segments: Record<string, number>; areas: string[]; spent: number };
type Detail = { customer: Row; orders: { id: string; orderNo: string; status: string; total: number; createdAt: string; items: string; payment: string }[] };
const SEG_STYLE: Record<string, string> = { new: "bg-sky-100 text-sky-800", regular: "bg-emerald-100 text-emerald-800", vip: "bg-amber-100 text-amber-800", inactive: "bg-gray-200 text-gray-600" };
const ST_STYLE: Record<string, string> = { active: "bg-emerald-100 text-emerald-800", inactive: "bg-gray-200 text-gray-600", blocked: "bg-red-100 text-red-700" };
const blank = { phone: "", name: "", whatsapp: "", email: "", address: "", area: "", notes: "", status: "active", segmentOverride: "" };
const waLink = (c: Pick<Customer, "phone" | "whatsapp" | "name">) => { const n = waNumber(c.whatsapp || c.phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(`Hello ${c.name}, `)}` : ""; };

export default function CustomersPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const [q, setQ] = useState(""); const [segment, setSegment] = useState(""); const [status, setStatus] = useState(""); const [area, setArea] = useState("");
  const [data, setData] = useState<List | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [form, setForm] = useState<{ id?: string; f: typeof blank } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Detail | null>(null); const [fu, setFu] = useState({ text: "", dueAt: "" });

  const load = useCallback(async () => {
    setError("");
    try { const u = new URLSearchParams({ q, segment, status, area }); setData(await api<List>(`/api/admin/customers?${u}`)); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [q, segment, status, area]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const openDetail = async (id: string) => { try { setDetail(await api<Detail>(`/api/admin/customers/${id}`)); setFu({ text: "", dueAt: "" }); } catch (e: any) { toast(e.message, "err"); } };
  const openForm = (c?: Row) => { setErrs({}); setForm(c ? { id: c.id, f: { phone: c.phone, name: c.name, whatsapp: c.whatsapp ?? "", email: c.email ?? "", address: c.address ?? "", area: c.area ?? "", notes: c.notes ?? "", status: c.status, segmentOverride: c.segmentOverride ?? "" } } : { f: { ...blank } }); };
  const save = async () => {
    if (!form) return; setBusy(true); setErrs({});
    try {
      const body: Record<string, unknown> = { ...form.f }; if (form.id) delete body.phone;
      await api(form.id ? `/api/admin/customers/${form.id}` : "/api/admin/customers", { method: form.id ? "PUT" : "POST", body });
      toast(form.id ? "Customer updated" : "Customer added"); setForm(null); load(); if (detail && form.id === detail.customer.id) openDetail(form.id);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const saveFollowUps = async (id: string, list: CustomerFollowUp[]) => { try { await api(`/api/admin/customers/${id}`, { method: "PUT", body: { followUps: list } }); await openDetail(id); } catch (e: any) { toast(e.message, "err"); } };
  const del = async (c: Row) => { if (!(await confirm(`Delete customer record “${c.name}”? Their orders are kept.`))) return; try { await api(`/api/admin/customers/${c.id}`, { method: "DELETE" }); toast("Customer deleted"); setDetail(null); load(); } catch (e: any) { toast(e.message, "err"); } };
  const sync = async () => { try { const r = await api<{ customers: number; created: number }>("/api/admin/customers/sync", { method: "POST" }); toast(`Synced ${r.customers} customers from orders (${r.created} new)`); load(); } catch (e: any) { toast(e.message, "err"); } };
  const exportXlsx = async () => { try { const res = await fetch("/api/admin/excel/export?dataset=customers", { credentials: "same-origin" }); if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Export failed"); const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a"); a.href = url; a.download = `daffomart-customers-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url); } catch (e: any) { toast(e.message, "err"); } };
  const f = form?.f; const set = (k: keyof typeof blank, v: string) => setForm((x) => (x ? { ...x, f: { ...x.f, [k]: v } } : x));

  return (
    <>
      {node}
      <PageHeader title="Customers (CRM)" subtitle="Customers are saved automatically from every order. The phone number is the unique key, so nobody is ever duplicated.">
        <button className="btn-outline" onClick={sync} title="Create customer records from all existing orders (safe to repeat)">Sync from orders</button>
        <button className="btn-outline" onClick={exportXlsx}><Icon name="upload" className="h-4 w-4 rotate-180" />Export Excel</button>
        <a className="btn-outline" href="/admin/data-transfer">Import</a>
        <button className="btn-primary" onClick={() => openForm()}><Icon name="plus" className="h-4 w-4" />Add customer</button>
      </PageHeader>
      {data && <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[["Total", data.total, ""], ["New", data.segments.new, "new"], ["Regular", data.segments.regular, "regular"], ["VIP", data.segments.vip, "vip"], ["Inactive", data.segments.inactive, "inactive"]].map(([l, n, k]) => (
          <button key={String(l)} onClick={() => setSegment(segment === k ? "" : String(k))} className={`card p-3 text-left ${segment === k && k ? "ring-2 ring-primary" : ""}`}><p className="text-xs font-semibold uppercase text-gray-500">{l}</p><p className="text-xl font-bold">{n as number}</p></button>))}
        <div className="card p-3"><p className="text-xs font-semibold uppercase text-gray-500">Lifetime spend</p><p className="text-xl font-bold">{taka(data.spent)}</p></div>
      </div>}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1"><Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search name, phone, email, address…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">All segments</option>{["new", "regular", "vip", "inactive"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["active", "inactive", "blocked"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
        <select className="input w-auto" value={area} onChange={(e) => setArea(e.target.value)}><option value="">All areas</option>{data?.areas.map((a) => <option key={a}>{a}</option>)}</select>
      </div>
      {loading ? <PageLoader /> : error ? <ErrorBox msg={error} retry={load} /> : !data?.items.length ? <div className="card"><Empty icon="users" title={data?.total ? "No customers match" : "No customers yet"} hint={data?.total ? "Try a different search or filter." : "They appear automatically when customers order. Use “Sync from orders” to import existing orders."} /></div> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[820px]"><thead className="border-b bg-gray-50"><tr><th className="th">Customer</th><th className="th">Phone</th><th className="th">Area</th><th className="th">Orders</th><th className="th">Spent</th><th className="th">Last order</th><th className="th">Segment</th><th className="th" /></tr></thead>
          <tbody className="divide-y">{data.items.map((c) => (
            <tr key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(c.id)}>
              <td className="td"><p className="font-semibold">{c.name}</p>{c.status !== "active" && <span className={`badge ${ST_STYLE[c.status]}`}>{c.status}</span>}</td>
              <td className="td font-mono text-xs">{c.phone}</td><td className="td text-gray-600">{c.area || "—"}</td><td className="td">{c.orderCount}</td><td className="td font-semibold">{taka(c.totalSpent)}</td><td className="td text-gray-500">{fmtDate(c.lastOrderAt)}</td>
              <td className="td"><span className={`badge ${SEG_STYLE[c.segment]}`}>{c.segment.toUpperCase()}</span></td>
              <td className="td text-right" onClick={(e) => e.stopPropagation()}>{c.status !== "blocked" && waLink(c) && <a className="btn-ghost btn-sm text-emerald-700" href={waLink(c)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}<a className="btn-ghost btn-sm" href={`tel:${c.phone}`}>Call</a></td>
            </tr>))}</tbody></table>
          {data.matched > data.items.length && <p className="border-t p-3 text-center text-xs text-gray-500">Showing the first {data.items.length} of {data.matched}. Narrow the search or export to Excel for the full list.</p>}</div>)}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.customer.name ?? ""} wide
        footer={detail && <><button className="btn-ghost text-red-600" onClick={() => del(detail.customer)}>Delete</button><button className="btn-outline" onClick={() => { openForm(detail.customer); }}>Edit</button></>}>
        {detail && (() => { const c = detail.customer; return (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2"><span className={`badge ${SEG_STYLE[c.segment]}`}>{c.segment.toUpperCase()}{c.segmentOverride ? " (set manually)" : ""}</span><span className={`badge ${ST_STYLE[c.status]}`}>{c.status}</span><span className="text-xs text-gray-400">Customer since {fmtDate(c.createdAt)} · via {c.source}</span></div>
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Orders</p><p className="text-lg font-bold">{c.orderCount}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Total spent</p><p className="text-lg font-bold">{taka(c.totalSpent)}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Last order</p><p className="text-lg font-bold">{fmtDate(c.lastOrderAt)}</p></div></div>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2"><div><dt className="text-xs text-gray-500">Phone</dt><dd className="font-mono">{c.phone}</dd></div><div><dt className="text-xs text-gray-500">WhatsApp</dt><dd className="font-mono">{c.whatsapp || "same as phone"}</dd></div><div><dt className="text-xs text-gray-500">Email</dt><dd>{c.email || "—"}</dd></div><div><dt className="text-xs text-gray-500">Area</dt><dd>{c.area || "—"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-gray-500">Address</dt><dd>{c.address || "—"}</dd></div>{c.notes && <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Notes</dt><dd className="whitespace-pre-line">{c.notes}</dd></div>}</dl>
            <div className="flex flex-wrap gap-2">{c.status !== "blocked" && waLink(c) && <a className="btn bg-[#25D366] text-white hover:bg-[#1da851]" href={waLink(c)} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}<a className="btn-outline" href={`tel:${c.phone}`}>📞 Call</a>{c.email && <a className="btn-outline" href={`mailto:${c.email}`}>✉️ Email</a>}</div>
            <div><h3 className="mb-2 font-bold">Follow-ups</h3>
              <ul className="space-y-1.5">{c.followUps.map((x) => (<li key={x.id} className="flex items-start gap-2 rounded-lg border p-2"><input type="checkbox" className="mt-1" checked={x.done} onChange={() => saveFollowUps(c.id, c.followUps.map((y) => y.id === x.id ? { ...y, done: !y.done } : y))} /><div className="min-w-0 flex-1"><p className={x.done ? "text-gray-400 line-through" : ""}>{x.text}</p><p className="text-[11px] text-gray-400">{x.dueAt ? `Due ${fmtDate(x.dueAt)} · ` : ""}{x.by} · {fmtDateTime(x.at)}</p></div><button className="text-xs text-red-600" onClick={() => saveFollowUps(c.id, c.followUps.filter((y) => y.id !== x.id))}>Remove</button></li>))}{!c.followUps.length && <li className="text-gray-400">No follow-ups yet.</li>}</ul>
              <div className="mt-2 flex flex-wrap gap-2"><input className="input min-w-[180px] flex-1" placeholder="e.g. Call about weekend offer" value={fu.text} onChange={(e) => setFu({ ...fu, text: e.target.value })} /><input type="date" className="input w-auto" value={fu.dueAt} onChange={(e) => setFu({ ...fu, dueAt: e.target.value })} /><button className="btn-primary" disabled={!fu.text.trim()} onClick={() => { saveFollowUps(c.id, [...c.followUps, { id: "", text: fu.text, dueAt: fu.dueAt || undefined, done: false, by: "", at: "" }]); setFu({ text: "", dueAt: "" }); }}>Add</button></div></div>
            <div><h3 className="mb-2 font-bold">Order history</h3>{detail.orders.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px]"><tbody className="divide-y">{detail.orders.map((o) => (<tr key={o.id}><td className="td font-mono text-xs">{o.orderNo}</td><td className="td text-gray-500">{fmtDate(o.createdAt)}</td><td className="td">{statusLabel(o.status)}</td><td className="td max-w-[220px] truncate text-gray-500" title={o.items}>{o.items}</td><td className="td text-right font-semibold">{taka(o.total)}</td></tr>))}</tbody></table></div> : <p className="text-gray-400">No orders yet.</p>}</div>
          </div>); })()}
      </Modal>

      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={form?.id ? "Edit customer" : "Add customer"}
        footer={<><button className="btn-outline" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {f && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" error={errs.phone} hint={form?.id ? "The phone number is the customer ID and cannot be changed" : "01XXXXXXXXX — duplicates are blocked"}><input className="input" inputMode="numeric" disabled={!!form?.id} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Name" error={errs.name}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="WhatsApp number" error={errs.whatsapp} hint="Leave empty if it is the same as the phone"><input className="input" inputMode="numeric" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
          <Field label="Email" error={errs.email}><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Address" className="sm:col-span-2"><textarea className="input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Area"><input className="input" value={f.area} onChange={(e) => set("area", e.target.value)} /></Field>
          <Field label="Status" error={errs.status} hint="Blocked customers cannot place online orders"><select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></select></Field>
          <Field label="Segment" hint="Automatic unless you choose one" className="sm:col-span-2"><select className="input" value={f.segmentOverride} onChange={(e) => set("segmentOverride", e.target.value)}><option value="">Automatic</option><option value="new">New</option><option value="regular">Regular</option><option value="vip">VIP</option><option value="inactive">Inactive</option></select></Field>
          <Field label="Notes" className="sm:col-span-2"><textarea className="input" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>}
      </Modal>
    </>
  );
}
