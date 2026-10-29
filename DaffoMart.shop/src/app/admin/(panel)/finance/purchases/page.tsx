"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, Field, Modal, PageHeader, PageLoader, Spinner, useToast } from "@/components/admin/ui";
import { PAY_METHODS, PayModal, Stat, tk, todayDhaka } from "@/components/admin/FinanceBits";

type Sup = { id: string; name: string; phone: string; purchased: number; paid: number; outstanding: number };
type Pur = { id: string; supplierId: string; supplierName: string; invoiceNo: string; date: string; total: number; paid: number; outstanding: number; received: boolean; items: { name: string; qty: number; unitCost: number }[] };
type Data = { suppliers: Sup[]; purchases: Pur[]; totalPayable: number; valuation: { value: number; productsValued: number; productsWithoutCost: number } };
type Line = { productId: string; qty: string; unitCost: string };

export default function PurchasesPage() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [supModal, setSupModal] = useState(false); const [sf, setSf] = useState({ name: "", phone: "" });
  const [pm, setPm] = useState(false);
  const [pf, setPf] = useState({ supplierId: "", invoiceNo: "", date: todayDhaka(), receive: true, paidNow: "", method: "cash" });
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: "1", unitCost: "" }]);
  const [pay, setPay] = useState<Pur | null>(null); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setD(await api<Data>("/api/admin/finance/purchases")); setErr(""); } catch (e: any) { setErr(e.message); } }, []);
  useEffect(() => { load(); api<{ items: any[] }>("/api/products?limit=500").then((r) => setProducts(r.items.flatMap((p) => (p.variants?.length ? p.variants.map((v: any) => ({ id: `${p.id}~${v.id}`, name: `${p.name} — ${[v.size, v.weight, v.color].filter(Boolean).join(" / ")}`, unit: "" })) : [{ id: p.id, name: p.name, unit: p.unit }])))).catch(() => {}); }, [load]);

  const total = lines.reduce((n, l) => n + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);
  const addSupplier = async () => { setBusy(true); try { await api("/api/admin/finance/suppliers", { method: "POST", body: sf }); toast("Supplier added"); setSupModal(false); setSf({ name: "", phone: "" }); load(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };
  const savePurchase = async () => {
    setBusy(true);
    try {
      await api("/api/admin/finance/purchases", { method: "POST", body: { supplierId: pf.supplierId, invoiceNo: pf.invoiceNo, date: pf.date, receive: pf.receive, paidNow: Number(pf.paidNow || 0), method: pf.method, items: lines.map((l) => ({ productId: l.productId.split("~")[0] || undefined, variantId: l.productId.split("~")[1] || undefined, name: l.productId ? undefined : "Other item", qty: Number(l.qty), unitCost: Number(l.unitCost) })) } });
      toast(pf.receive ? "Purchase saved and stock added" : "Purchase saved"); setPm(false); setLines([{ productId: "", qty: "1", unitCost: "" }]); load();
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const receive = async (p: Pur) => { try { await api(`/api/admin/finance/purchases/${p.id}/receive`, { method: "POST" }); toast("Stock added"); load(); } catch (e: any) { toast(e.message, "err"); } };

  if (!d && !err) return <PageLoader />;
  return (
    <>
      <PageHeader title="Purchases & Suppliers" subtitle="Receiving a purchase adds stock once and updates the average product cost. A bill (supplier + invoice no.) cannot be entered twice. Do not also add the same purchase as a manual expense.">
        <button className="btn-outline" onClick={() => setSupModal(true)}>Add supplier</button>
        <button className="btn-primary" onClick={() => { setPf({ ...pf, supplierId: d?.suppliers[0]?.id ?? "" }); setPm(true); }} disabled={!d?.suppliers.length}>New purchase</button>
      </PageHeader>
      {err && <ErrorBox msg={err} retry={load} />}
      {d && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Owed to suppliers" value={tk(d.totalPayable)} tone={d.totalPayable > 0 ? "bad" : "good"} />
            <Stat label="Stock value (at cost)" value={tk(d.valuation.value)} sub={`${d.valuation.productsValued} products valued`} />
            <Stat label="Products without cost" value={String(d.valuation.productsWithoutCost)} sub="in stock, cost unknown: not valued" />
          </div>
          <div className="card mb-5 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="th">Supplier</th><th className="th text-right">Purchased</th><th className="th text-right">Paid</th><th className="th text-right">Outstanding</th></tr></thead>
            <tbody>{d.suppliers.map((s) => <tr key={s.id} className="border-t"><td className="td"><b>{s.name}</b> <span className="text-xs text-gray-500">{s.phone}</span></td><td className="td text-right">{tk(s.purchased)}</td><td className="td text-right">{tk(s.paid)}</td><td className="td text-right font-semibold">{tk(s.outstanding)}</td></tr>)}{!d.suppliers.length && <tr><td className="td text-gray-400" colSpan={4}>Add your first supplier.</td></tr>}</tbody></table></div>
          <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Supplier / invoice</th><th className="th text-right">Total</th><th className="th text-right">Outstanding</th><th className="th">Stock</th><th className="th text-right">Actions</th></tr></thead>
            <tbody>{d.purchases.map((p) => (
              <tr key={p.id} className="border-t"><td className="td">{p.date}</td><td className="td"><b>{p.supplierName}</b><div className="text-xs text-gray-500">{p.invoiceNo || "no invoice no."} · {p.items.length} line(s)</div></td>
                <td className="td text-right">{tk(p.total)}</td><td className="td text-right font-semibold">{tk(p.outstanding)}</td>
                <td className="td">{p.received ? <span className="badge bg-emerald-100 text-emerald-800">Received</span> : <span className="badge bg-amber-100 text-amber-800">Not received</span>}</td>
                <td className="td whitespace-nowrap text-right">{!p.received && <button className="btn-outline px-2 py-1 text-xs" onClick={() => receive(p)}>Receive stock</button>}{" "}<button className="btn-primary px-2 py-1 text-xs" disabled={p.outstanding <= 0} onClick={() => setPay(p)}>Pay</button></td></tr>))}
              {!d.purchases.length && <tr><td className="td text-gray-400" colSpan={6}>No purchases yet.</td></tr>}</tbody></table></div>
        </>
      )}

      <Modal open={supModal} onClose={() => setSupModal(false)} title="Add supplier" footer={<><button className="btn-outline" onClick={() => setSupModal(false)}>Cancel</button><button className="btn-primary" disabled={busy || sf.name.trim().length < 2} onClick={addSupplier}>Save</button></>}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Name"><input className="input" value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} /></Field><Field label="Phone"><input className="input" value={sf.phone} onChange={(e) => setSf({ ...sf, phone: e.target.value })} /></Field></div>
      </Modal>

      <Modal open={pm} onClose={() => setPm(false)} wide title="New purchase" footer={<><button className="btn-outline" onClick={() => setPm(false)}>Cancel</button><button className="btn-primary" disabled={busy || !pf.supplierId || total <= 0} onClick={savePurchase}>{busy ? <Spinner className="h-4 w-4" /> : `Save · ${tk(total)}`}</button></>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Supplier"><select className="input" value={pf.supplierId} onChange={(e) => setPf({ ...pf, supplierId: e.target.value })}>{d?.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Invoice no."><input className="input" value={pf.invoiceNo} onChange={(e) => setPf({ ...pf, invoiceNo: e.target.value })} /></Field>
          <Field label="Date"><input className="input" type="date" value={pf.date} onChange={(e) => setPf({ ...pf, date: e.target.value })} /></Field>
        </div>
        <div className="mt-3 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_6rem_2rem] gap-2">
              <select className="input" value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}><option value="">Other item (no stock)</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}</select>
              <input className="input" inputMode="numeric" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <input className="input" inputMode="decimal" placeholder="Unit cost" value={l.unitCost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))} />
              <button className="text-red-600" aria-label="Remove line" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}>✕</button>
            </div>))}
          <button className="btn-outline px-2 py-1 text-xs" onClick={() => setLines([...lines, { productId: "", qty: "1", unitCost: "" }])}>+ Add line</button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pf.receive} onChange={(e) => setPf({ ...pf, receive: e.target.checked })} />Add stock now</label>
          <Field label="Paid now (৳)"><input className="input" inputMode="decimal" value={pf.paidNow} onChange={(e) => setPf({ ...pf, paidNow: e.target.value })} /></Field>
          <Field label="Method"><select className="input" value={pf.method} onChange={(e) => setPf({ ...pf, method: e.target.value })}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        </div>
      </Modal>
      {pay && <PayModal open onClose={() => setPay(null)} title={`Pay ${pay.supplierName} · ${pay.invoiceNo || "purchase"}`} kind="supplier" refId={pay.id} outstanding={pay.outstanding} onDone={load} />}
    </>
  );
}
