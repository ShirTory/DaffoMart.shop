"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Empty, ErrorBox, Icon, Modal, PageHeader, PageLoader, StatusBadge, Thumb, useConfirm, useList, useToast } from "@/components/admin/ui";
import { fmtDateTime, statusLabel, taka } from "@/lib/format";
import { hasPin, mapsDirections, mapsEmbed, mapsView } from "@/lib/maps";
import { riderApproved } from "@/lib/rider";
import { ORDER_STATUSES, PAYMENT_LABEL, type Courier, type DeliveryZone, type Order, type Rider } from "@/lib/types";

export default function OrdersPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const couriers = useList<Courier[]>("/api/couriers"); const zones = useList<DeliveryZone[]>("/api/zones"); const [trk, setTrk] = useState("");
  const { data, setData, loading, error, reload } = useList<Order[]>("/api/orders");
  const riders = useList<Rider[]>("/api/riders");
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sel, setSel] = useState<Order | null>(null);

  useEffect(() => { // deep link from dashboard: /admin/orders?open=<id>
    const id = new URLSearchParams(window.location.search).get("open");
    if (id && data) setSel(data.find((o) => o.id === id) ?? null);
  }, [data]);

  const counts = useMemo(() => { const c: Record<string, number> = { all: data?.length ?? 0 }; data?.forEach((o) => (c[o.status] = (c[o.status] ?? 0) + 1)); return c; }, [data]);
  const list = useMemo(() => (data ?? []).filter((o) => (tab === "all" || o.status === tab) && (!q || `${o.orderNo} ${o.name} ${o.phone}`.toLowerCase().includes(q.toLowerCase()))), [data, tab, q]);

  useEffect(() => { setTrk(sel?.trackingNo ?? ""); }, [sel?.id, sel?.trackingNo]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (o: Order) => { setData((d) => d?.map((x) => (x.id === o.id ? o : x)) ?? d); setSel((s) => (s?.id === o.id ? o : s)); };
  const setStatus = async (o: Order, status: string) => {
    try { patch(await api<Order>(`/api/orders/${o.id}`, { method: "PATCH", body: { status } })); toast(`Order ${o.orderNo} marked ${statusLabel(status)}`); } catch (e: any) { toast(e.message, "err"); }
  };
  const assign = async (o: Order, riderId: string) => {
    try { patch(await api<Order>(`/api/orders/${o.id}`, { method: "PATCH", body: { riderId } })); toast(riderId ? "Rider assigned" : "Rider removed"); } catch (e: any) { toast(e.message, "err"); }
  };
  const payStatus = async (o: Order, paymentStatus: string) => {
    try { patch(await api<Order>(`/api/orders/${o.id}`, { method: "PATCH", body: { paymentStatus } })); toast(`Payment marked ${paymentStatus}`); } catch (e: any) { toast(e.message, "err"); }
  };
  const del = async (o: Order) => {
    if (!(await confirm(`Delete order ${o.orderNo} permanently? This cannot be undone.`))) return;
    try { await api(`/api/orders/${o.id}`, { method: "DELETE" }); setData((d) => d?.filter((x) => x.id !== o.id) ?? d); setSel(null); toast("Order deleted"); } catch (e: any) { toast(e.message, "err"); }
  };
  const print = (o: Order) => { window.open(`/admin/invoice/${o.id}`, "_blank", "noopener"); };
  const assignCourier = async (o: Order, courierId: string, trackingNo?: string) => {
    try { patch(await api<Order>(`/api/orders/${o.id}`, { method: "PATCH", body: { courierId, ...(trackingNo !== undefined ? { trackingNo } : {}) } })); toast(courierId ? "Courier saved" : "Courier removed"); } catch (e: any) { toast(e.message, "err"); }
  };
  const saveTracking = async (o: Order) => {
    try { patch(await api<Order>(`/api/orders/${o.id}`, { method: "PATCH", body: { trackingNo: trk.trim() } })); toast(trk.trim() ? "Tracking number saved — order marked on the way" : "Tracking number cleared"); } catch (e: any) { toast(e.message, "err"); }
  };

  const tabs = ["all", ...ORDER_STATUSES];
  return (
    <>
      <PageHeader title="Orders" subtitle="Track and manage customer orders" />
      <div className="card overflow-hidden">
        <div className="border-b p-4">
          <div className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-2">
            {tabs.map((s) => (
              <button key={s} onClick={() => setTab(s)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === s ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {s === "all" ? "All" : statusLabel(s)}<span className={`rounded-full px-1.5 text-xs ${tab === s ? "bg-white/25" : "bg-gray-100"}`}>{counts[s] ?? 0}</span></button>))}
          </div>
          <div className="relative mt-2 max-w-sm"><Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search order no, name or phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {loading ? <PageLoader /> : error ? <div className="p-4"><ErrorBox msg={error} retry={reload} /></div> : list.length === 0 ? <Empty icon="orders" title="No orders found" hint={data?.length ? "Try a different filter or search." : "Orders placed on your store will show up here."} /> : (
          <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[980px]">
            <thead className="bg-gray-50"><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Total</th><th className="th">Payment</th><th className="th">Date</th><th className="th">Rider</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody className="divide-y">{list.map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSel(o)}>
                <td className="td font-semibold text-primary">{o.orderNo}</td>
                <td className="td"><p className="font-medium">{o.name}</p><p className="text-xs text-gray-500">{o.phone}</p></td>
                <td className="td text-gray-600">{o.items.reduce((n, i) => n + i.qty, 0)} item(s)</td>
                <td className="td font-semibold">{taka(o.total)}</td>
                <td className="td text-xs"><span className="font-medium">{o.paymentLabel ?? PAYMENT_LABEL[o.payment] ?? o.payment}</span><br /><StatusBadge status={o.paymentStatus === "paid" ? "delivered" : o.paymentStatus === "pending" ? "pending" : o.paymentStatus === "failed" ? "cancelled" : "inactive"} label={o.paymentStatus === "pending" ? "Verify" : (o.paymentStatus ?? "unpaid")} /></td>
                <td className="td whitespace-nowrap text-gray-500">{fmtDateTime(o.createdAt)}</td>
                <td className="td text-sm text-gray-600">{o.riderName || <span className="text-gray-300">—</span>}</td>
                <td className="td" onClick={(e) => e.stopPropagation()}>
                  <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold" value={o.status} onChange={(e) => setStatus(o, e.target.value)}>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></td>
                <td className="td text-right text-gray-400"><Icon name="external" className="h-4 w-4" /></td>
              </tr>))}</tbody></table></div>)}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `Order ${sel.orderNo}` : ""} wide
        footer={sel && <><button className="btn-outline mr-auto text-red-600" onClick={() => del(sel)}><Icon name="trash" className="h-4 w-4" />Delete</button><button className="btn-outline" onClick={() => print(sel)}><Icon name="print" className="h-4 w-4" />Invoice</button><button className="btn-primary" onClick={() => setSel(null)}>Close</button></>}>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><StatusBadge status={sel.status} /><p className="mt-1 text-xs text-gray-500">Placed {fmtDateTime(sel.createdAt)}</p></div>
              <div className="flex items-center gap-2"><span className="label mb-0">Update status</span><select className="input w-auto" value={sel.status} onChange={(e) => setStatus(sel, e.target.value)}>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4 text-sm"><p className="label">Customer</p><p className="font-semibold">{sel.name}</p>
                <a href={`tel:${sel.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-primary"><Icon name="phone" className="h-4 w-4" />{sel.phone}</a></div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm"><p className="label">Delivery address</p><p>{sel.address}</p><p className="mt-1 text-xs text-gray-500">{sel.zoneName ?? (sel.zone === "inside" ? "Inside Dhaka" : sel.zone === "outside" ? "Outside Dhaka" : sel.zone)} · {sel.payment === "cod" ? "Cash on delivery" : sel.payment}</p></div>
            </div>
            <div className="rounded-xl border p-4 text-sm"><p className="label">Payment</p>
              <div className="flex flex-wrap items-center gap-2"><b>{sel.paymentLabel ?? PAYMENT_LABEL[sel.payment] ?? sel.payment}</b><StatusBadge status={sel.paymentStatus === "paid" ? "delivered" : sel.paymentStatus === "pending" ? "pending" : sel.paymentStatus === "failed" ? "cancelled" : "inactive"} label={sel.paymentStatus === "pending" ? "Pending verification" : (sel.paymentStatus ?? "unpaid")} /></div>
              {(sel.paymentRef || sel.paymentFrom) && <p className="mt-2 rounded-lg bg-gray-50 p-2.5">TrxID: <b className="font-mono">{sel.paymentRef}</b>{sel.paymentFrom && <> · Paid from <b>{sel.paymentFrom}</b></>} · Amount to verify: <b>{taka(sel.total)}</b></p>}
              <div className="mt-3 flex flex-wrap gap-2">{sel.paymentStatus !== "paid" && <button className="btn-primary btn-sm" onClick={() => payStatus(sel, "paid")}>Mark as paid</button>}{sel.paymentStatus !== "failed" && sel.paymentStatus !== "paid" && <button className="btn-outline btn-sm text-red-600" onClick={() => payStatus(sel, "failed")}>Mark failed</button>}{sel.paymentStatus === "paid" && <button className="btn-outline btn-sm" onClick={() => payStatus(sel, "refunded")}>Mark refunded</button>}</div></div>
            <div className="rounded-xl border p-4 text-sm"><p className="label">Delivery location</p>
              <iframe title="Delivery map" src={mapsEmbed(sel)} className="h-52 w-full rounded-lg border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs"><span className="text-gray-500">{hasPin(sel) ? "📍 Exact pin shared by customer" : "Map is searched from the typed address"}</span><a className="font-semibold text-primary" href={mapsView(sel)} target="_blank" rel="noopener noreferrer">Open in Google Maps</a><a className="font-semibold text-primary" href={mapsDirections(sel)} target="_blank" rel="noopener noreferrer">Get directions</a></div></div>
            {sel.hasRx && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>℞ Contains prescription medicine.</b> Call the customer and verify the prescription before dispatch.</div>}
            <div className="rounded-xl border p-4 text-sm"><p className="label">Delivery rider</p>
              <div className="flex flex-wrap items-center gap-3"><select className="input w-auto min-w-[200px]" value={sel.riderId ?? ""} onChange={(e) => assign(sel, e.target.value)}><option value="">— Not assigned —</option>{riders.data?.filter((r) => (r.active && riderApproved(r)) || r.id === sel.riderId).map((r) => <option key={r.id} value={r.id}>{r.name} · {r.phone}</option>)}</select>
                {sel.riderPhone && <a href={`tel:${sel.riderPhone}`} className="inline-flex items-center gap-1.5 text-primary"><Icon name="phone" className="h-4 w-4" />{sel.riderPhone}</a>}
                {!riders.data?.length && <a href="/admin/riders" className="text-xs font-semibold text-primary underline">Add riders first</a>}</div></div>
            {(() => { const viaCourier = zones.data?.find((z) => z.id === sel.zone)?.viaCourier || !!sel.courierId; const list = couriers.data?.filter((c) => c.active || c.id === sel.courierId) ?? [];
              return (
                <div className={`rounded-xl border p-4 text-sm ${viaCourier && !sel.courierId ? "border-amber-300 bg-amber-50" : ""}`}>
                  <p className="label">Courier service {viaCourier && !sel.courierId && <span className="ml-1 font-normal text-amber-700">· outside Dhaka — assign a courier</span>}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <select className="input w-auto min-w-[200px]" value={sel.courierId ?? ""} onChange={(e) => assignCourier(sel, e.target.value)}><option value="">— No courier —</option>{list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    {sel.courierId && <><input className="input w-auto min-w-[180px]" placeholder="Tracking / consignment no." value={trk} maxLength={60} onChange={(e) => setTrk(e.target.value)} /><button className="btn-primary btn-sm" onClick={() => saveTracking(sel)} disabled={trk.trim() === (sel.trackingNo ?? "")}>Save tracking</button></>}
                    {sel.courierUrl && <a className="text-xs font-semibold text-primary underline" href={sel.courierUrl} target="_blank" rel="noopener noreferrer">Open tracking page ↗</a>}
                    {!couriers.loading && !couriers.data?.length && <a href="/admin/couriers" className="text-xs font-semibold text-primary underline">Add a courier first</a>}
                  </div>
                </div>); })()}
            {sel.note && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Note:</b> {sel.note}</div>}
            <div className="overflow-hidden rounded-xl border"><table className="w-full"><tbody className="divide-y">{sel.items.map((i) => (
              <tr key={i.id}><td className="td"><div className="flex items-center gap-3"><Thumb src={i.image} emoji={i.emoji} /><div><p className="font-medium">{i.name}</p><p className="text-xs text-gray-500">{i.unit} · {taka(i.price)}</p></div></div></td><td className="td text-gray-500">× {i.qty}</td><td className="td text-right font-semibold">{taka(i.price * i.qty)}</td></tr>))}</tbody></table></div>
            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{taka(sel.subtotal)}</dd></div>
              {sel.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount {sel.couponCode && `(${sel.couponCode})`}</dt><dd>−{taka(sel.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-500">Delivery</dt><dd>{taka(sel.delivery)}</dd></div>
              <div className="flex justify-between border-t pt-2 text-base font-bold"><dt>Total</dt><dd className="text-primary">{taka(sel.total)}</dd></div>
            </dl>
          </div>)}
      </Modal>
      {node}
    </>
  );
}
