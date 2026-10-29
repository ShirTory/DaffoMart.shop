"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, Field, Modal, PageHeader, PageLoader, Spinner, useToast } from "@/components/admin/ui";
import { PayModal, Stat, downloadCsv, monthDhaka, reversePayment, tk, todayDhaka } from "@/components/admin/FinanceBits";

type St = { rider: { id: string; name: string; phone: string }; terms: { from: string; perDelivery: number; commissionPct: number }[]; deliveries: number; earned: number; adjustments: number; paid: number; balance: number; unrated: number;
  rows: { orderId: string; orderNo: string; date: string; deliveryCharge: number; earned: number; rated: boolean }[]; adjustmentRows: { id: string; date: string; amount: number; reason?: string }[]; paymentRows: { id: string; date: string; amount: number; method: string; reference: string }[] };
type All = { from: string; to: string; rows: St[]; earned: number; adjustments: number; paid: number; outstanding: number };

export default function RiderEarningsPage() {
  const toast = useToast();
  const [from, setFrom] = useState(monthDhaka() + "-01"); const [to, setTo] = useState(todayDhaka());
  const [data, setData] = useState<All | null>(null); const [err, setErr] = useState("");
  const [terms, setTerms] = useState<St | null>(null); const [tf, setTf] = useState({ from: todayDhaka(), perDelivery: "", commissionPct: "0" });
  const [adj, setAdj] = useState<St | null>(null); const [af, setAf] = useState({ amount: "", reason: "", date: todayDhaka() });
  const [pay, setPay] = useState<St | null>(null); const [stmt, setStmt] = useState<St | null>(null); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setData(await api<All>(`/api/admin/finance/rider-earnings?from=${from}&to=${to}`)); setErr(""); } catch (e: any) { setErr(e.message); setData(null); } }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const post = async (body: object, ok: string, close: () => void) => { setBusy(true); try { await api("/api/admin/finance/rider-earnings", { method: "POST", body }); toast(ok); close(); load(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };
  const openStmt = async (id: string) => { try { setStmt(await api<St>(`/api/admin/finance/rider-earnings?riderId=${id}&from=${from}&to=${to}`)); } catch (e: any) { toast(e.message, "err"); } };
  const exportCsv = () => data && downloadCsv(`rider-earnings-${from}_${to}.csv`, [["Rider", "Deliveries", "Earned", "Adjustments", "Paid in period", "Balance owed"], ...data.rows.map((r) => [r.rider.name, r.deliveries, r.earned, r.adjustments, r.paid, r.balance])]);

  if (!data && !err) return <PageLoader />;
  return (
    <>
      <PageHeader title="Rider Earnings" subtitle="Earnings come from DELIVERED orders only (each order once). Cancelled, failed and returned deliveries earn nothing. Rider pay is a business expense, never customer revenue.">
        <input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn-outline" onClick={exportCsv} disabled={!data}>Export CSV</button>
      </PageHeader>
      {err && <ErrorBox msg={err} retry={load} />}
      {data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Earned (period)" value={tk(data.earned)} /><Stat label="Adjustments" value={tk(data.adjustments)} sub="bonus / fixed pay / deductions" />
            <Stat label="Paid (period)" value={tk(data.paid)} tone="good" /><Stat label="Total owed to riders" value={tk(data.outstanding)} tone={data.outstanding > 0 ? "bad" : "good"} sub="all unpaid up to end date" />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="th">Rider</th><th className="th text-right">Deliveries</th><th className="th text-right">Earned</th><th className="th text-right">Adjust.</th><th className="th text-right">Paid</th><th className="th text-right">Balance</th><th className="th text-right">Actions</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.rider.id} className="border-t">
                    <td className="td"><div className="font-semibold">{r.rider.name}</div><div className="text-xs text-gray-500">{r.rider.phone}{!r.terms.length && <span className="ml-2 badge bg-amber-100 text-amber-800">No pay terms</span>}{r.unrated > 0 && <span className="ml-2 badge bg-red-100 text-red-700">{r.unrated} deliveries unrated</span>}</div></td>
                    <td className="td text-right">{r.deliveries}</td><td className="td text-right tabular-nums">{tk(r.earned)}</td><td className="td text-right tabular-nums">{tk(r.adjustments)}</td><td className="td text-right tabular-nums">{tk(r.paid)}</td>
                    <td className="td text-right font-semibold tabular-nums">{tk(r.balance)}</td>
                    <td className="td whitespace-nowrap text-right">
                      <button className="btn-primary px-2 py-1 text-xs" disabled={r.balance <= 0} onClick={() => setPay(r)}>Pay</button>{" "}
                      <button className="btn-outline px-2 py-1 text-xs" onClick={() => { setTerms(r); const t = r.terms[r.terms.length - 1]; setTf({ from: todayDhaka(), perDelivery: t ? String(t.perDelivery) : "", commissionPct: t ? String(t.commissionPct) : "0" }); }}>Terms</button>{" "}
                      <button className="btn-outline px-2 py-1 text-xs" onClick={() => { setAdj(r); setAf({ amount: "", reason: "", date: todayDhaka() }); }}>Adjust</button>{" "}
                      <button className="btn-outline px-2 py-1 text-xs" onClick={() => openStmt(r.rider.id)}>Statement</button>
                    </td>
                  </tr>))}
                {!data.rows.length && <tr><td className="td text-gray-400" colSpan={7}>No approved riders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={!!terms} onClose={() => setTerms(null)} title={terms ? `Pay terms · ${terms.rider.name}` : ""} footer={<><button className="btn-outline" onClick={() => setTerms(null)}>Cancel</button><button className="btn-primary" disabled={busy || tf.perDelivery === ""} onClick={() => post({ action: "terms", riderId: terms!.rider.id, from: tf.from, perDelivery: Number(tf.perDelivery), commissionPct: Number(tf.commissionPct || 0) }, "Pay terms saved", () => setTerms(null))}>{busy ? <Spinner className="h-4 w-4" /> : "Save"}</button></>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Effective from"><input className="input" type="date" value={tf.from} onChange={(e) => setTf({ ...tf, from: e.target.value })} /></Field>
          <Field label="Per delivery (৳)"><input className="input" inputMode="decimal" value={tf.perDelivery} onChange={(e) => setTf({ ...tf, perDelivery: e.target.value })} /></Field>
          <Field label="% of delivery charge"><input className="input" inputMode="decimal" value={tf.commissionPct} onChange={(e) => setTf({ ...tf, commissionPct: e.target.value })} /></Field>
        </div>
        <p className="mt-2 text-xs text-gray-500">Earning per delivered order = per-delivery amount + % of the delivery charge the customer paid. Changing terms affects only deliveries on or after the date. For a fixed monthly salary use <b>Adjust</b> (reason: monthly pay).</p>
        {terms && terms.terms.length > 0 && <ul className="mt-2 text-xs text-gray-600">{terms.terms.map((t) => <li key={t.from}>From {t.from}: ৳{t.perDelivery} + {t.commissionPct}%</li>)}</ul>}
      </Modal>

      <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? `Adjustment · ${adj.rider.name}` : ""} footer={<><button className="btn-outline" onClick={() => setAdj(null)}>Cancel</button><button className="btn-primary" disabled={busy || !Number(af.amount) || af.reason.trim().length < 3} onClick={() => post({ action: "adjust", riderId: adj!.rider.id, amount: Number(af.amount), reason: af.reason, date: af.date }, "Adjustment saved", () => setAdj(null))}>Save</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (৳, minus to deduct)"><input className="input" inputMode="decimal" value={af.amount} onChange={(e) => setAf({ ...af, amount: e.target.value })} /></Field>
          <Field label="Date"><input className="input" type="date" value={af.date} onChange={(e) => setAf({ ...af, date: e.target.value })} /></Field>
          <Field label="Reason (required)" className="sm:col-span-2"><input className="input" value={af.reason} onChange={(e) => setAf({ ...af, reason: e.target.value })} placeholder="e.g. Eid bonus, monthly fixed pay, damaged parcel" /></Field>
        </div>
      </Modal>

      {pay && <PayModal open onClose={() => setPay(null)} title={`Pay ${pay.rider.name}`} kind="rider" refId={pay.rider.id} outstanding={pay.balance} onDone={load} />}

      <Modal open={!!stmt} onClose={() => setStmt(null)} wide title={stmt ? `Earnings statement · ${stmt.rider.name} · ${from} → ${to}` : ""} footer={<><button className="btn-outline" onClick={() => window.print()}>Print</button><button className="btn-primary" onClick={() => setStmt(null)}>Close</button></>}>
        {stmt && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-4 gap-2"><Stat label="Deliveries" value={String(stmt.deliveries)} /><Stat label="Earned" value={tk(stmt.earned)} /><Stat label="Paid" value={tk(stmt.paid)} tone="good" /><Stat label="Balance" value={tk(stmt.balance)} tone={stmt.balance > 0 ? "bad" : "good"} /></div>
            <div className="max-h-56 overflow-auto rounded-lg border"><table className="w-full"><thead className="sticky top-0 bg-gray-50"><tr><th className="th">Date</th><th className="th">Order</th><th className="th text-right">Delivery charge</th><th className="th text-right">Earned</th></tr></thead>
              <tbody>{stmt.rows.map((x) => <tr key={x.orderId} className="border-t"><td className="td">{x.date}</td><td className="td">#{x.orderNo}</td><td className="td text-right">{tk(x.deliveryCharge)}</td><td className="td text-right">{x.rated ? tk(x.earned) : <span className="text-red-600">no rate</span>}</td></tr>)}</tbody></table></div>
            <h4 className="font-bold">Adjustments</h4>
            <ul className="divide-y rounded-lg border">{stmt.adjustmentRows.map((a) => <li key={a.id} className="p-2">{a.date} · <b>{tk(a.amount)}</b> · {a.reason}</li>)}{!stmt.adjustmentRows.length && <li className="p-2 text-gray-400">None</li>}</ul>
            <h4 className="font-bold">Payments</h4>
            <ul className="divide-y rounded-lg border">{stmt.paymentRows.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 p-2"><span>{p.date} · {p.method}{p.reference ? ` · ${p.reference}` : ""} · <b>{tk(p.amount)}</b></span><button className="text-xs font-semibold text-red-600" onClick={() => reversePayment(p.id, toast, () => { openStmt(stmt.rider.id); load(); })}>Reverse</button></li>)}{!stmt.paymentRows.length && <li className="p-2 text-gray-400">None</li>}</ul>
          </div>
        )}
      </Modal>
    </>
  );
}
