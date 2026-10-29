"use client";
import { useRef, useState } from "react";
import { PageHeader, Spinner, useToast } from "@/components/admin/ui";

type Report = { dataset: string; commit: boolean; totalRows: number; valid: number; created: number; updated: number; skipped: number; errors: { row: number; key?: string; message: string }[]; warnings: string[]; changes: string[] };
const SETS = [
  { id: "products", label: "Products", imp: true, note: "Matched by SKU. Stock of existing products is not changed here (use Inventory)." },
  { id: "inventory", label: "Inventory", imp: true, note: "Set stock or add/remove quantities by SKU. Every change is written to the stock log." },
  { id: "customers", label: "Customers", imp: true, note: "Matched by normalized phone number: no duplicates. Blank cells never erase data." },
  { id: "orders", label: "Orders", imp: false, note: "Export only (importing would bypass stock, payment and finance rules). Optional date / status filters." },
  { id: "reports", label: "Reports", imp: false, note: "Sales by day, top products, payment methods, low stock, customer segments. Needs Finance access." },
];
const today = () => new Date().toISOString().slice(0, 10);

export default function DataTransferPage() {
  const toast = useToast(); const [busy, setBusy] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [status, setStatus] = useState("");
  const [ds, setDs] = useState("products"); const [mode, setMode] = useState("upsert"); const [file, setFile] = useState<File | null>(null); const [rep, setRep] = useState<Report | null>(null); const input = useRef<HTMLInputElement>(null);
  const download = async (set: string, template = false) => {
    setBusy(set + (template ? "-t" : ""));
    try {
      const u = new URLSearchParams({ dataset: set }); if (template) u.set("template", "1"); if (from) u.set("from", from); if (to) u.set("to", to); if (status && set === "orders") u.set("status", status);
      const res = await fetch(`/api/admin/excel/export?${u}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Export failed");
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `daffomart-${set}.xlsx`;
      const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(""); }
  };
  const run = async (commit: boolean) => {
    if (!file) return; setBusy(commit ? "commit" : "preview");
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("dataset", ds); fd.append("commit", commit ? "1" : "0"); fd.append("mode", mode);
      const res = await fetch("/api/admin/excel/import", { method: "POST", body: fd, credentials: "same-origin" }); const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error ?? "Import failed");
      setRep(j.data); if (commit) { toast(`Imported: ${j.data.created} created, ${j.data.updated} updated, ${j.data.errors.length} rejected`); setFile(null); if (input.current) input.current.value = ""; }
    } catch (e: any) { toast(e.message, "err"); setRep(null); } finally { setBusy(""); }
  };
  const importable = SETS.filter((s) => s.imp);
  return (
    <>
      <PageHeader title="Excel Import / Export" subtitle="Move data in and out with .xlsx workbooks. Imports are always previewed first and nothing changes until you confirm." />
      <section className="card mb-6 p-5"><h2 className="mb-1 text-lg font-bold">Export</h2><p className="mb-4 text-sm text-gray-500">Download a workbook, or the empty template (with an Instructions sheet) for importing.</p>
        <div className="mb-4 flex flex-wrap gap-3"><label className="text-xs font-semibold text-gray-500">From<input type="date" className="input mt-1 w-auto" max={today()} value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs font-semibold text-gray-500">To<input type="date" className="input mt-1 w-auto" max={today()} value={to} onChange={(e) => setTo(e.target.value)} /></label><label className="text-xs font-semibold text-gray-500">Order status<select className="input mt-1 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{["pending", "confirmed", "processing", "assigned", "picked_up", "on_the_way", "delivered", "cancelled", "returned"].map((s) => <option key={s}>{s}</option>)}</select></label><p className="self-end pb-2 text-xs text-gray-400">Dates apply to Orders and Reports (reports default to the last 30 days).</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SETS.map((s) => (<div key={s.id} className="rounded-xl border p-4"><p className="font-bold">{s.label}</p><p className="mt-1 min-h-[3rem] text-xs text-gray-500">{s.note}</p><div className="mt-3 flex gap-2"><button className="btn-primary btn-sm" disabled={!!busy} onClick={() => download(s.id)}>{busy === s.id && <Spinner className="h-3 w-3" />}Download .xlsx</button>{s.imp && <button className="btn-outline btn-sm" disabled={!!busy} onClick={() => download(s.id, true)}>Template</button>}</div></div>))}</div></section>
      <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Import</h2>
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-gray-500">What are you importing?<select className="input mt-1" value={ds} onChange={(e) => { setDs(e.target.value); setRep(null); }}>{importable.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label className="text-xs font-semibold text-gray-500">Existing records<select className="input mt-1" value={mode} onChange={(e) => { setMode(e.target.value); setRep(null); }}><option value="upsert">Update them</option><option value="skip_existing">Skip them (only add new)</option></select></label>
          <label className="text-xs font-semibold text-gray-500">Excel file (.xlsx, max 5 MB, 2,000 rows)<input ref={input} type="file" accept=".xlsx" className="input mt-1" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRep(null); }} /></label></div>
        <p className="mt-2 text-xs text-gray-500">{importable.find((s) => s.id === ds)?.note}</p>
        <div className="mt-4 flex gap-2"><button className="btn-outline" disabled={!file || !!busy} onClick={() => run(false)}>{busy === "preview" && <Spinner className="h-4 w-4" />}1. Check file (no changes)</button><button className="btn-primary" disabled={!file || !rep || rep.commit || !rep.valid || !!busy} onClick={() => run(true)}>{busy === "commit" && <Spinner className="h-4 w-4" />}2. Import {rep && !rep.commit ? `${rep.valid} valid row${rep.valid === 1 ? "" : "s"}` : ""}</button></div>
        {rep && <div className="mt-5 space-y-3 text-sm">
          <div className={`rounded-xl p-4 ${rep.commit ? "bg-emerald-50 text-emerald-900" : "bg-blue-50 text-blue-900"}`}><b>{rep.commit ? "Import finished" : "Preview — nothing has been changed yet"}.</b> {rep.totalRows} rows read · {rep.created} {rep.commit ? "created" : "will be created"} · {rep.updated} {rep.commit ? "updated" : "will be updated"}{rep.skipped ? ` · ${rep.skipped} skipped (already exist)` : ""} · <b className={rep.errors.length ? "text-red-700" : ""}>{rep.errors.length} with errors{rep.errors.length && !rep.commit ? " (these rows are skipped)" : ""}</b></div>
          {rep.warnings.map((w, i) => <p key={i} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">⚠ {w}</p>)}
          {!!rep.errors.length && <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[420px]"><thead className="bg-gray-50"><tr><th className="th">Row</th><th className="th">Key</th><th className="th">Problem</th></tr></thead><tbody className="divide-y">{rep.errors.slice(0, 200).map((e, i) => <tr key={i}><td className="td">{e.row}</td><td className="td font-mono text-xs">{e.key ?? ""}</td><td className="td text-red-700">{e.message}</td></tr>)}</tbody></table></div>}
          {!!rep.changes.length && <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{rep.commit ? "What was changed" : "What will change"} (first {rep.changes.length})</summary><ul className="mt-2 space-y-0.5 text-xs text-gray-600">{rep.changes.map((c, i) => <li key={i}>{c}</li>)}</ul></details>}
        </div>}
      </section>
    </>
  );
}
