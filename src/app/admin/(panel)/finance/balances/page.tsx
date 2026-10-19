"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, Field, Modal, PageHeader, PageLoader, useToast } from "@/components/admin/ui";
import { PayModal, Stat, tk, todayDhaka } from "@/components/admin/FinanceBits";

type Data = {
  accounts: { asOf: string; rows: { account: string; label: string; opening: number; openingDate: string; cashIn: number; cashOut: number; balance: number }[]; total: number };
  receivables: { rows: { orderId: string; orderNo: string; name: string; phone: string; date: string; total: number; collected: number; outstanding: number }[]; total: number };
  payables: { suppliers: number; salaryThisMonth: number };
  valuation: { value: number; productsWithoutCost: number };
};

export default function BalancesPage() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState("");
  const [ob, setOb] = useState(false); const [of, setOf] = useState({ method: "cash", openingBalance: "", openingDate: todayDhaka() });
  const [col, setCol] = useState<Data["receivables"]["rows"][number] | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setD(await api<Data>("/api/admin/finance/balances")); setErr(""); } catch (e: any) { setErr(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const saveOb = async () => { setBusy(true); try { await api("/api/admin/finance/balances", { method: "POST", body: { ...of, openingBalance: Number(of.openingBalance) } }); toast("Opening balance saved"); setOb(false); load(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };

  if (!d && !err) return <PageLoader />;
  return (
    <>
      <PageHeader title="Balances & Dues" subtitle="Each payment method is a money account: opening balance + money in − money out. Only movements on or after the opening date count; nothing is invented.">
        <button className="btn-primary" onClick={() => setOb(true)}>Set opening balance</button>
      </PageHeader>
      {err && <ErrorBox msg={err} retry={load} />}
      {d && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Total cash + accounts" value={tk(d.accounts.total)} sub={`as of ${d.accounts.asOf}`} />
            <Stat label="Customers owe" value={tk(d.receivables.total)} sub="delivered, not yet paid" />
            <Stat label="You owe suppliers" value={tk(d.payables.suppliers)} tone={d.payables.suppliers > 0 ? "bad" : "good"} />
            <Stat label="Salary unpaid (this month)" value={tk(d.payables.salaryThisMonth)} tone={d.payables.salaryThisMonth > 0 ? "bad" : "good"} />
          </div>
          <div className="card mb-5 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="th">Account</th><th className="th text-right">Opening</th><th className="th text-right">Money in</th><th className="th text-right">Money out</th><th className="th text-right">Balance</th></tr></thead>
            <tbody>{d.accounts.rows.map((r) => <tr key={r.account} className="border-t"><td className="td"><b>{r.label}</b>{r.openingDate && <div className="text-xs text-gray-500">opening on {r.openingDate}</div>}{!r.openingDate && <div className="text-xs text-amber-700">no opening balance set</div>}</td><td className="td text-right">{tk(r.opening)}</td><td className="td text-right">{tk(r.cashIn)}</td><td className="td text-right">{tk(r.cashOut)}</td><td className="td text-right font-semibold">{tk(r.balance)}</td></tr>)}
              {!d.accounts.rows.length && <tr><td className="td text-gray-400" colSpan={5}>No money movements recorded yet.</td></tr>}</tbody></table></div>
          <h2 className="mb-2 font-bold">Customer receivables</h2>
          <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="th">Order</th><th className="th">Customer</th><th className="th text-right">Total</th><th className="th text-right">Collected</th><th className="th text-right">Outstanding</th><th className="th" /></tr></thead>
            <tbody>{d.receivables.rows.map((r) => <tr key={r.orderId} className="border-t"><td className="td">#{r.orderNo}<div className="text-xs text-gray-500">{r.date}</div></td><td className="td">{r.name}<div className="text-xs text-gray-500">{r.phone}</div></td><td className="td text-right">{tk(r.total)}</td><td className="td text-right">{tk(r.collected)}</td><td className="td text-right font-semibold">{tk(r.outstanding)}</td><td className="td text-right"><button className="btn-primary px-2 py-1 text-xs" onClick={() => setCol(r)}>Record collection</button></td></tr>)}
              {!d.receivables.rows.length && <tr><td className="td text-gray-400" colSpan={6}>Nothing outstanding.</td></tr>}</tbody></table></div>
        </>
      )}
      <Modal open={ob} onClose={() => setOb(false)} title="Opening balance" footer={<><button className="btn-outline" onClick={() => setOb(false)}>Cancel</button><button className="btn-primary" disabled={busy || of.openingBalance === ""} onClick={saveOb}>Save</button></>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Account"><input className="input" list="acct-list" value={of.method} onChange={(e) => setOf({ ...of, method: e.target.value })} /><datalist id="acct-list">{["cash", "bkash", "nagad", "bank", "rocket"].map((m) => <option key={m} value={m} />)}</datalist></Field>
          <Field label="Balance (৳)"><input className="input" inputMode="decimal" value={of.openingBalance} onChange={(e) => setOf({ ...of, openingBalance: e.target.value })} /></Field>
          <Field label="As of date"><input className="input" type="date" value={of.openingDate} onChange={(e) => setOf({ ...of, openingDate: e.target.value })} /></Field>
        </div>
        <p className="mt-2 text-xs text-gray-500">Enter the real amount you counted or saw in the account on that date. Movements before that date are ignored for this account.</p>
      </Modal>
      {col && <PayModal open onClose={() => setCol(null)} title={`Collection · order #${col.orderNo}`} kind="receivable" refId={col.orderId} outstanding={col.outstanding} onDone={load} />}
    </>
  );
}
