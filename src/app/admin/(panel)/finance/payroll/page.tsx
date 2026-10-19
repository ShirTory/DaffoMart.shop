"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, Field, Modal, PageHeader, PageLoader, Spinner, useToast } from "@/components/admin/ui";
import { PayModal, Stat, downloadCsv, monthDhaka, reversePayment, tk, todayDhaka } from "@/components/admin/FinanceBits";

type Entry = { id: string; period: string; base: number; allowances: number; bonus: number; overtime: number; deductions: number; advances: number; amount: number; note: string; revision: number; createdBy: string; updatedBy?: string };
type Row = { employeeId: string; name: string; role: string; agreedSalary: number; entry: Entry | null; payable: number; paid: number; outstanding: number };
type Summary = { period: string; rows: Row[]; totalPayable: number; totalPaid: number; totalOutstanding: number };
type Statement = { employee: { id: string; name: string; role: string }; entries: Entry[]; payments: { id: string; refId: string; date: string; amount: number; method: string; reference: string }[]; payable: number; paid: number; outstanding: number };
const blank = { base: "", allowances: "", bonus: "", overtime: "", deductions: "", advances: "", note: "" };

export default function PayrollPage() {
  const toast = useToast();
  const [period, setPeriod] = useState(monthDhaka());
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [f, setF] = useState(blank);
  const [pay, setPay] = useState<Row | null>(null);
  const [term, setTerm] = useState<Row | null>(null);
  const [tf, setTf] = useState({ amount: "", from: todayDhaka() });
  const [stmt, setStmt] = useState<Statement | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<Summary>(`/api/admin/finance/payroll?period=${period}`)); setErr(""); } catch (e: any) { setErr(e.message); setData(null); }
  }, [period]);
  useEffect(() => { load(); }, [load]);

  const openEdit = (r: Row) => { setEdit(r); const e = r.entry; setF(e ? { base: String(e.base), allowances: String(e.allowances), bonus: String(e.bonus), overtime: String(e.overtime), deductions: String(e.deductions), advances: String(e.advances), note: e.note } : { ...blank, base: String(r.agreedSalary) }); };
  const num = (s: string) => (s === "" ? 0 : Number(s));
  const saveEntry = async () => {
    if (!edit) return; setBusy(true);
    try { await api("/api/admin/finance/payroll", { method: "POST", body: { action: "entry", employeeId: edit.employeeId, period, base: f.base === "" ? "" : Number(f.base), allowances: num(f.allowances), bonus: num(f.bonus), overtime: num(f.overtime), deductions: num(f.deductions), advances: num(f.advances), note: f.note } }); toast("Payroll entry saved"); setEdit(null); load(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const saveTerm = async () => {
    if (!term) return; setBusy(true);
    try { await api("/api/admin/finance/payroll", { method: "POST", body: { action: "salary-term", employeeId: term.employeeId, amount: Number(tf.amount), from: tf.from } }); toast("Salary updated from " + tf.from + ". Earlier months keep their recorded amount."); setTerm(null); load(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const openStmt = async (r: Row) => { try { setStmt(await api<Statement>(`/api/admin/finance/payroll?employeeId=${r.employeeId}`)); } catch (e: any) { toast(e.message, "err"); } };
  const exportCsv = () => data && downloadCsv(`payroll-${period}.csv`, [["Staff", "Role", "Agreed salary", "Net payable", "Paid", "Outstanding"], ...data.rows.map((r) => [r.name, r.role, r.agreedSalary, r.payable, r.paid, r.outstanding])]);

  if (!data && !err) return <PageLoader />;
  const preview = edit ? num(f.base) + num(f.allowances) + num(f.bonus) + num(f.overtime) - num(f.deductions) - num(f.advances) : 0;
  return (
    <>
      <PageHeader title="Staff Payroll" subtitle="One entry per person per month. Payments can be partial; a mistaken payment is reversed, never deleted. Record salaries here, not as plain expenses.">
        <input type="month" className="input w-44" value={period} max={monthDhaka()} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        <button className="btn-outline" onClick={exportCsv} disabled={!data}>Export CSV</button>
      </PageHeader>
      {err && <ErrorBox msg={err} retry={load} />}
      {data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Net payable" value={tk(data.totalPayable)} sub={period} />
            <Stat label="Paid" value={tk(data.totalPaid)} tone="good" />
            <Stat label="Outstanding" value={tk(data.totalOutstanding)} tone={data.totalOutstanding > 0 ? "bad" : "good"} />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="th">Staff</th><th className="th text-right">Agreed</th><th className="th text-right">Net payable</th><th className="th text-right">Paid</th><th className="th text-right">Outstanding</th><th className="th text-right">Actions</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.employeeId} className="border-t">
                    <td className="td"><div className="font-semibold">{r.name}</div><div className="text-xs text-gray-500">{r.role}</div></td>
                    <td className="td text-right tabular-nums">{tk(r.agreedSalary)}</td>
                    <td className="td text-right tabular-nums">{r.entry ? tk(r.payable) : <span className="badge bg-amber-100 text-amber-800">No entry</span>}</td>
                    <td className="td text-right tabular-nums">{tk(r.paid)}</td>
                    <td className="td text-right font-semibold tabular-nums">{tk(r.outstanding)}</td>
                    <td className="td whitespace-nowrap text-right">
                      <button className="btn-outline px-2 py-1 text-xs" onClick={() => openEdit(r)}>{r.entry ? "Edit" : "Create"}</button>{" "}
                      <button className="btn-primary px-2 py-1 text-xs" disabled={!r.entry || r.outstanding <= 0} onClick={() => setPay(r)}>Pay</button>{" "}
                      <button className="btn-outline px-2 py-1 text-xs" onClick={() => { setTerm(r); setTf({ amount: String(r.agreedSalary), from: todayDhaka() }); }}>Salary</button>{" "}
                      <button className="btn-outline px-2 py-1 text-xs" onClick={() => openStmt(r)}>Statement</button>
                    </td>
                  </tr>
                ))}
                {!data.rows.length && <tr><td className="td text-gray-400" colSpan={6}>No approved staff yet. Add staff in Team → Staff.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.name} · ${period}` : ""} footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" disabled={busy || preview < 0} onClick={saveEntry}>{busy ? <Spinner className="h-4 w-4" /> : "Save entry"}</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["base", "Base salary"], ["allowances", "Allowances"], ["bonus", "Bonus"], ["overtime", "Overtime"], ["deductions", "Deductions (absence etc.)"], ["advances", "Advances taken"]] as const).map(([k, l]) => (
            <Field key={k} label={`${l} (৳)`}><input className="input" inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>))}
          <Field label="Note" className="sm:col-span-2"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <p className={`mt-3 text-sm font-semibold ${preview < 0 ? "text-red-600" : ""}`}>Net payable: {tk(preview)}</p>
        {edit?.entry && <p className="mt-1 text-xs text-gray-500">Revision {edit.entry.revision} · created by {edit.entry.createdBy}{edit.entry.updatedBy ? ` · last edited by ${edit.entry.updatedBy}` : ""}. Base is the amount recorded for this month and does not change when the current salary changes.</p>}
      </Modal>

      <Modal open={!!term} onClose={() => setTerm(null)} title={term ? `Salary for ${term.name}` : ""} footer={<><button className="btn-outline" onClick={() => setTerm(null)}>Cancel</button><button className="btn-primary" disabled={busy || !(Number(tf.amount) >= 0) || tf.amount === ""} onClick={saveTerm}>Save</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New monthly salary (৳)"><input className="input" inputMode="decimal" value={tf.amount} onChange={(e) => setTf({ ...tf, amount: e.target.value })} /></Field>
          <Field label="Effective from"><input className="input" type="date" value={tf.from} onChange={(e) => setTf({ ...tf, from: e.target.value })} /></Field>
        </div>
        <p className="mt-2 text-xs text-gray-500">Months already on payroll keep their recorded amount. New months from this date use the new salary.</p>
      </Modal>

      {pay?.entry && <PayModal open onClose={() => setPay(null)} title={`Pay ${pay.name} · ${period}`} kind="salary" refId={pay.entry.id} outstanding={pay.outstanding} onDone={load} />}

      <Modal open={!!stmt} onClose={() => setStmt(null)} wide title={stmt ? `Salary statement · ${stmt.employee.name}` : ""} footer={<><button className="btn-outline" onClick={() => window.print()}>Print</button><button className="btn-primary" onClick={() => setStmt(null)}>Close</button></>}>
        {stmt && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2"><Stat label="Payable" value={tk(stmt.payable)} /><Stat label="Paid" value={tk(stmt.paid)} tone="good" /><Stat label="Outstanding" value={tk(stmt.outstanding)} tone={stmt.outstanding > 0 ? "bad" : "good"} /></div>
            <table className="w-full"><thead className="bg-gray-50"><tr><th className="th">Month</th><th className="th text-right">Base</th><th className="th text-right">+/−</th><th className="th text-right">Net</th></tr></thead>
              <tbody>{stmt.entries.map((e) => <tr key={e.id} className="border-t"><td className="td">{e.period}</td><td className="td text-right">{tk(e.base)}</td><td className="td text-right">{tk(e.allowances + e.bonus + e.overtime - e.deductions - e.advances)}</td><td className="td text-right font-semibold">{tk(e.amount)}</td></tr>)}</tbody></table>
            <h4 className="font-bold">Payments</h4>
            <ul className="divide-y rounded-lg border">{stmt.payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 p-2"><span>{p.date} · {p.method}{p.reference ? ` · ${p.reference}` : ""} · <b>{tk(p.amount)}</b></span><button className="text-xs font-semibold text-red-600" onClick={() => reversePayment(p.id, toast, () => { openStmt({ employeeId: stmt.employee.id } as Row); load(); })}>Reverse</button></li>)}{!stmt.payments.length && <li className="p-2 text-gray-400">No payments yet</li>}</ul>
          </div>
        )}
      </Modal>
    </>
  );
}
