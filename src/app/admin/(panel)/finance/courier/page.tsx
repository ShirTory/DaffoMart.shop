"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useList, useToast } from "@/components/admin/ui";
import { taka } from "@/lib/format";
import type { Courier, CourierAuditEntry } from "@/lib/types";
import type { ParcelRow, CourierSummary } from "@/server/courier";

type Data = { rows: ParcelRow[]; summary: CourierSummary; doubleCount: { expenseId: string; orderId: string; amount: number; category: string }[] };
/** today in Bangladesh time (the server dates revenue by Dhaka days) */
const ymdNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const monthStart = () => ymdNow().slice(0, 7) + "-01";
const STATUS_LABEL: Record<string, string> = { in_transit: "In transit", delivered: "Delivered", returned: "Returned", cancelled: "Cancelled" };
const t2 = (n: number) => `৳${(Math.round(n * 100) / 100).toLocaleString("en-US")}`;

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-gray-900";
  return <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className={`mt-1 text-xl font-bold ${c}`}>{value}</p>{sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}</div>;
}

export default function CourierAccountsPage() {
  const toast = useToast();
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(ymdNow()); const [courierId, setCourierId] = useState("");
  const couriers = useList<Courier[]>("/api/couriers");
  const { data, loading, error, reload } = useList<Data>(`/api/admin/finance/courier?from=${from}&to=${to}${courierId ? `&courierId=${courierId}` : ""}`);
  const [edit, setEdit] = useState<{ row: ParcelRow; f: Record<string, string>; verified: boolean; reason: string } | null>(null);
  const [hist, setHist] = useState<{ row: ParcelRow; items: CourierAuditEntry[] } | null>(null);
  const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});

  const open = (r: ParcelRow) => { setErrs({}); setEdit({ row: r, verified: r.verified, reason: "", f: { codAmount: String(r.codAmount), amountReceived: String(r.amountReceived), deliveryCharge: String(r.deliveryCharge), deliveryChargePaidBy: r.deliveryChargePaidBy, returnStatus: r.returnStatus, returnCharge: String(r.returnCharge), returnChargePaidBy: r.returnChargePaidBy, costDate: r.costDate, settlementRef: r.settlementRef, note: r.note } }); };
  const set = (k: string, v: string) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const f = edit.f;
      await api(`/api/admin/finance/courier/${edit.row.orderId}`, { method: "PUT", body: { codAmount: f.codAmount === "" ? null : Number(f.codAmount), amountReceived: Number(f.amountReceived || 0), deliveryCharge: Number(f.deliveryCharge || 0), deliveryChargePaidBy: f.deliveryChargePaidBy, returnStatus: f.returnStatus, returnCharge: Number(f.returnCharge || 0), returnChargePaidBy: f.returnChargePaidBy, costDate: f.costDate, settlementRef: f.settlementRef, note: f.note, verified: edit.verified, reason: edit.reason || undefined } });
      toast(edit.verified ? "Saved and posted to Accounts" : "Saved (not posted to Accounts until verified)"); setEdit(null); reload();
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields || {}); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const showHist = async (r: ParcelRow) => { try { setHist({ row: r, items: await api<CourierAuditEntry[]>(`/api/admin/finance/courier/${r.orderId}`) }); } catch (e: any) { toast(e.message, "err"); } };
  const s = data?.summary;

  return (
    <>
      <PageHeader title="Courier Accounts" subtitle="Every courier parcel: COD, what the courier paid you, charges and returns. Verified parcels post their company-paid charges to Accounts once.">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="From"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Courier"><select className="input" value={courierId} onChange={(e) => setCourierId(e.target.value)}><option value="">All</option>{(couriers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
      </PageHeader>
      <details className="mb-4 rounded-xl bg-primary-soft p-3 text-sm text-primary-dark">
        <summary className="cursor-pointer font-semibold">How the figures are calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b>COD collected</b> = the COD amount of <i>delivered</i> parcels. Returned, cancelled and in-transit parcels collected nothing.</li>
          <li><b>Paid by company</b> charges are your cost; the courier deducts them from the cash it sends you. <b>Paid by customer</b> charges were paid to the courier by the customer directly: not your cost and not deducted.</li>
          <li><b>Expected remittance</b> = COD collected − company-paid delivery charge − company-paid return charge. <b>Outstanding</b> = expected − amount received.</li>
          <li>Delivered revenue comes from the order and is already in Accounts; nothing here adds revenue again. Only <b>verified</b> parcels post a cost to Accounts (one entry per parcel). Costs of returned parcels are shown as <b>return loss</b>.</li>
          <li>Charges you have not entered are treated as unknown (shown as ৳0 and listed as &quot;no charges entered&quot;), never estimated.</li>
        </ul>
      </details>
      {loading ? <PageLoader /> : error || !data || !s ? <ErrorBox msg={error || "Failed to load"} retry={reload} /> : (
        <>
          {data.doubleCount.length > 0 && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠ {data.doubleCount.length} manual &quot;Delivery/Courier&quot; expense(s) are linked to orders that a verified courier record also posts ({data.doubleCount.map((d) => `${taka(d.amount)}`).join(", ")}). Delete the manual expense(s) in Finance → Expenses so the cost is not counted twice.</p>}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card label="Parcels" value={String(s.parcels)} sub={`${s.delivered} delivered · ${s.returned} returned · ${s.inTransit} in transit`} />
            <Card label="Delivered revenue" value={t2(s.deliveredRevenue)} sub="from orders (already in Accounts)" />
            <Card label="COD collected" value={t2(s.codCollected)} />
            <Card label="Expected remittance" value={t2(s.expectedRemittance)} sub="after company-paid charges" />
            <Card label="Received from couriers" value={t2(s.amountReceived)} tone="good" />
            <Card label="Courier owes you (verified)" value={t2(s.receivableVerified)} tone={s.receivableVerified > 0 ? "warn" : undefined} />
            <Card label="Owes you (unverified)" value={t2(s.receivableUnverified)} sub={`${s.unverifiedParcels} parcel(s) not verified yet`} />
            <Card label="Delivery expense / return loss" value={`${t2(s.deliveryExpense)} / ${t2(s.returnLoss)}`} tone="bad" sub="company-paid charges" />
          </div>
          {s.costsMissing > 0 && <p className="mb-3 text-sm text-amber-700">{s.costsMissing} delivered/returned parcel(s) have no charges entered yet.</p>}
          {!data.rows.length ? <Empty icon="delivery" title="No courier parcels in this period" hint="Assign a courier to an order (Orders → open order) and it appears here automatically." /> : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500">{["Order", "Courier", "Status", "COD", "Received", "Delivery chg", "Return chg", "Outstanding", "Verified", ""].map((h) => <th key={h} className="th whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.orderId} className="border-t">
                      <td className="td whitespace-nowrap"><p className="font-semibold">{r.orderNo}</p><p className="text-xs text-gray-500">{r.costDate}</p></td>
                      <td className="td"><p>{r.courierName}</p>{r.trackingNo && <p className="text-xs text-gray-500">{r.trackingNo}</p>}</td>
                      <td className="td"><StatusBadge status={r.parcelStatus === "delivered" ? "delivered" : r.parcelStatus === "returned" ? "returned" : r.parcelStatus === "cancelled" ? "cancelled" : "pending"} label={STATUS_LABEL[r.parcelStatus]} /></td>
                      <td className="td">{t2(r.codAmount)}</td>
                      <td className="td">{t2(r.amountReceived)}</td>
                      <td className="td">{t2(r.deliveryCharge)}<p className="text-[11px] text-gray-500">{r.deliveryCharge > 0 ? `by ${r.deliveryChargePaidBy}` : r.hasRecord ? "" : "not entered"}</p></td>
                      <td className="td">{t2(r.returnCharge)}<p className="text-[11px] text-gray-500">{r.returnCharge > 0 ? `by ${r.returnChargePaidBy}` : ""}</p></td>
                      <td className={`td font-semibold ${r.outstanding > 0 ? "text-amber-600" : ""}`}>{t2(r.outstanding)}</td>
                      <td className="td">{r.verified ? <span className="badge bg-emerald-100 text-emerald-700">Verified</span> : <span className="badge bg-gray-100 text-gray-600">Unverified</span>}</td>
                      <td className="td whitespace-nowrap"><button className="btn-outline btn-sm" onClick={() => open(r)}>Edit</button>{r.auditCount > 0 && <button className="btn-ghost btn-sm" onClick={() => showHist(r)}>History</button>}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </>)}

      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit ? `Parcel ${edit.row.orderNo} · ${edit.row.courierName}` : ""} footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Order total {t2(edit.row.orderTotal)} · order status {edit.row.orderStatus}. COD is counted only when the order is delivered.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="COD amount (৳)" hint="Leave as is unless the courier collected a different amount" error={errs.codAmount}><input className="input" type="number" min="0" value={edit.f.codAmount} onChange={(e) => set("codAmount", e.target.value)} /></Field>
              <Field label="Amount received from courier (৳)" error={errs.amountReceived}><input className="input" type="number" min="0" value={edit.f.amountReceived} onChange={(e) => set("amountReceived", e.target.value)} /></Field>
              <Field label="Delivery charge (৳)" error={errs.deliveryCharge}><input className="input" type="number" min="0" value={edit.f.deliveryCharge} onChange={(e) => set("deliveryCharge", e.target.value)} /></Field>
              <Field label="Delivery charge paid by"><select className="input" value={edit.f.deliveryChargePaidBy} onChange={(e) => set("deliveryChargePaidBy", e.target.value)}><option value="company">Company</option><option value="customer">Customer</option></select></Field>
              <Field label="Return status"><select className="input" value={edit.f.returnStatus} onChange={(e) => set("returnStatus", e.target.value)}><option value="none">No return</option><option value="in_transit">Return in transit</option><option value="returned">Returned</option></select></Field>
              <Field label="Return charge (৳)" error={errs.returnCharge}><input className="input" type="number" min="0" value={edit.f.returnCharge} onChange={(e) => set("returnCharge", e.target.value)} /></Field>
              <Field label="Return charge paid by"><select className="input" value={edit.f.returnChargePaidBy} onChange={(e) => set("returnChargePaidBy", e.target.value)}><option value="company">Company</option><option value="customer">Customer</option></select></Field>
              <Field label="Cost date" hint="Day the cost belongs to in Accounts"><input className="input" type="date" value={edit.f.costDate} onChange={(e) => set("costDate", e.target.value)} /></Field>
              <Field label="Settlement / invoice ref"><input className="input" value={edit.f.settlementRef} onChange={(e) => set("settlementRef", e.target.value)} /></Field>
              <Field label="Note"><input className="input" value={edit.f.note} onChange={(e) => set("note", e.target.value)} /></Field>
            </div>
            <Toggle checked={edit.verified} onChange={(v) => setEdit({ ...edit, verified: v })} label="Verified against the courier statement (posts company-paid charges to Accounts)" />
            {edit.row.verified && <Field label="Reason for the correction (required, kept in history)" error={errs.reason}><input className="input" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></Field>}
          </div>)}
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title={hist ? `History · ${hist.row.orderNo}` : ""}>
        {hist && <ul className="space-y-3 text-sm">{[...hist.items].reverse().map((h, i) => (
          <li key={i} className="rounded-lg border p-3"><p className="font-semibold">{h.action} · {h.by}</p><p className="text-xs text-gray-500">{new Date(h.at).toLocaleString()}</p>{h.reason && <p className="mt-1">Reason: {h.reason}</p>}
            <ul className="mt-1 text-xs text-gray-600">{Object.entries(h.changes).map(([k, [a, b]]) => <li key={k}>{k}: {String(a ?? "—")} → {String(b ?? "—")}</li>)}</ul></li>))}</ul>}
      </Modal>
    </>
  );
}
