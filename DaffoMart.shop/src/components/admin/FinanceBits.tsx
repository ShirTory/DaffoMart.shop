"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field, Modal, Spinner, useToast } from "./ui";

/** Taka with paisa (the dashboard `taka()` rounds to whole taka, which hides real accounting differences). */
export const tk = (n: number) => `৳${(Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
export const PAY_METHODS = ["cash", "bkash", "nagad", "bank", "rocket", "other"];
/** Today in Dhaka (UTC+6), the business calendar. */
export const todayDhaka = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
export const monthDhaka = () => todayDhaka().slice(0, 7);

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

/** Download rows as CSV (UTF-8 with BOM so Excel shows ৳ and Bangla correctly). */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/** Records a payment / collection. A fresh idempotency key per opening means a double tap can never pay twice. */
export function PayModal({ open, onClose, title, kind, refId, outstanding, onDone }: { open: boolean; onClose: () => void; title: string; kind: "salary" | "rider" | "supplier" | "receivable"; refId: string; outstanding: number; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: "", date: todayDhaka(), method: "cash", reference: "", note: "" });
  const [key, setKey] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ amount: String(outstanding > 0 ? outstanding : ""), date: todayDhaka(), method: "cash", reference: "", note: "" }); setKey(crypto.randomUUID()); } }, [open, outstanding]);
  const save = async () => {
    setBusy(true);
    try { await api("/api/admin/finance/payments", { method: "POST", body: { kind, refId, ...f, amount: Number(f.amount), idempotencyKey: key } }); toast("Saved"); onClose(); onDone(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !(Number(f.amount) > 0)} onClick={save}>{busy ? <Spinner className="h-4 w-4" /> : "Save"}</button></>}>
      <p className="mb-3 text-sm text-gray-600">Outstanding: <b>{tk(outstanding)}</b>. Partial amounts are fine.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (৳)"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Method"><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference / TrxID"><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Note" className="sm:col-span-2"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/** Reverse a posted payment (kept in the history with who/why). */
export async function reversePayment(id: string, toast: (m: string, t?: any) => void, done: () => void) {
  const reason = window.prompt("Why is this payment being reversed? (required)");
  if (!reason || reason.trim().length < 3) return;
  try { await api(`/api/admin/finance/payments/${id}`, { method: "POST", body: { reason } }); toast("Payment reversed"); done(); }
  catch (e: any) { toast(e.message, "err"); }
}
