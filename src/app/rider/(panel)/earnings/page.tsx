"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/admin/ui";
import { tk } from "@/components/admin/FinanceBits";

type S = { from: string; to: string; deliveries: number; earned: number; adjustments: number; paid: number; balance: number; rows: { orderNo: string; date: string; earned: number; rated: boolean }[]; paymentRows: { id: string; date: string; amount: number; method: string }[]; adjustmentRows: { id: string; date: string; amount: number; reason?: string }[] };
const dhaka = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);

/** A rider sees only their own earnings and payments (the API takes the rider from the session). */
export default function RiderEarnings() {
  const [from, setFrom] = useState(dhaka().slice(0, 7) + "-01"); const [to, setTo] = useState(dhaka());
  const [s, setS] = useState<S | null>(null); const [err, setErr] = useState("");
  useEffect(() => { api<S>(`/api/riders/me/earnings?from=${from}&to=${to}`).then((r) => { setS(r); setErr(""); }).catch((e) => setErr(e.message)); }, [from, to]);
  return (
    <div className="mx-auto max-w-xl pb-10">
      <header className="flex items-center justify-between bg-primary-deeper px-4 py-3 text-white"><h1 className="font-bold">My earnings</h1><Link href="/rider" className="text-sm underline">Back</Link></header>
      <div className="flex gap-2 p-3"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {err && <p className="mx-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!s && !err && <PageLoader />}
      {s && (
        <div className="space-y-3 px-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            {[["Deliveries", String(s.deliveries)], ["Earned", tk(s.earned)], ["Paid to me", tk(s.paid)], ["Still owed to me", tk(s.balance)]].map(([l, v]) => <div key={l} className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-extrabold">{v}</p></div>)}
          </div>
          <h2 className="font-bold">Deliveries</h2>
          <ul className="divide-y rounded-xl border bg-white text-sm">{s.rows.map((r) => <li key={r.orderNo + r.date} className="flex justify-between p-3"><span>#{r.orderNo} · {r.date}</span><b>{r.rated ? tk(r.earned) : "—"}</b></li>)}{!s.rows.length && <li className="p-3 text-gray-400">No delivered orders in this period</li>}</ul>
          <h2 className="font-bold">Payments received</h2>
          <ul className="divide-y rounded-xl border bg-white text-sm">{s.paymentRows.map((p) => <li key={p.id} className="flex justify-between p-3"><span>{p.date} · {p.method}</span><b>{tk(p.amount)}</b></li>)}{!s.paymentRows.length && <li className="p-3 text-gray-400">None</li>}</ul>
          {s.adjustmentRows.length > 0 && <><h2 className="font-bold">Bonuses / deductions</h2><ul className="divide-y rounded-xl border bg-white text-sm">{s.adjustmentRows.map((a) => <li key={a.id} className="flex justify-between p-3"><span>{a.date} · {a.reason}</span><b>{tk(a.amount)}</b></li>)}</ul></>}
        </div>
      )}
    </div>
  );
}
