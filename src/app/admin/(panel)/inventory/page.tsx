"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Empty, ErrorBox, Field, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Thumb, useList, useToast } from "@/components/admin/ui";
import { fmtDateTime, taka } from "@/lib/format";
import type { Category, Product, StockLog } from "@/lib/types";

type Mode = "add" | "remove" | "set";
export default function InventoryPage() {
  const toast = useToast();
  const prods = useList<{ items: Product[] }>("/api/products?limit=500"); const cats = useList<Category[]>("/api/categories"); const logs = useList<StockLog[]>("/api/admin/inventory");
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [flt, setFlt] = useState(""); const [tab, setTab] = useState<"stock" | "log">("stock");
  const [adj, setAdj] = useState<{ p: Product; mode: Mode; qty: string; reason: string } | null>(null); const [busy, setBusy] = useState(false);
  const items = prods.data?.items ?? [];
  const catName = (id: string) => cats.data?.find((c) => c.id === id)?.name ?? "—";
  const sum = useMemo(() => ({ units: items.reduce((n, p) => n + p.stock, 0), value: items.reduce((n, p) => n + p.stock * p.price, 0), low: items.filter((p) => p.stock > 0 && p.stock <= 10).length, out: items.filter((p) => p.stock <= 0).length }), [items]);
  const list = useMemo(() => items.filter((p) => (!q || `${p.name} ${p.genericName ?? ""}`.toLowerCase().includes(q.toLowerCase())) && (!cat || p.categoryId === cat) && (!flt || (flt === "low" ? p.stock > 0 && p.stock <= 10 : flt === "out" ? p.stock <= 0 : p.stock > 10))).sort((a, b) => a.stock - b.stock), [items, q, cat, flt]);

  const apply = async () => {
    if (!adj) return; setBusy(true);
    try {
      const r = await api<{ product: Product; log: StockLog }>("/api/admin/inventory", { method: "POST", body: { productId: adj.p.id, mode: adj.mode, qty: adj.qty, reason: adj.reason } });
      prods.setData((d) => ({ items: d!.items.map((x) => (x.id === r.product.id ? r.product : x)) })); logs.setData((l) => [r.log, ...(l ?? [])]);
      toast(`${r.product.name}: stock is now ${r.product.stock}`); setAdj(null);
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const modes: [Mode, string][] = [["add", "Add stock"], ["remove", "Remove stock"], ["set", "Set exact count"]];
  return (
    <>
      <PageHeader title="Inventory" subtitle="Track stock levels and every stock movement" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[["Units in stock", String(sum.units), "bg-blue-50 text-blue-600"], ["Stock value", taka(sum.value), "bg-emerald-50 text-emerald-600"], ["Low stock (≤10)", String(sum.low), "bg-amber-50 text-amber-600"], ["Out of stock", String(sum.out), "bg-red-50 text-red-600"]].map(([l, v, c]) => (
          <div key={l} className="card p-4"><p className="text-xs font-medium text-gray-500">{l}</p><p className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-xl font-bold ${c}`}>{v}</p></div>))}
      </div>
      <div className="mt-5 flex gap-1 rounded-lg bg-gray-200/70 p-1 text-sm font-semibold sm:w-fit">{([["stock", "Stock levels"], ["log", "Stock history"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-md px-4 py-1.5 ${tab === k ? "bg-white text-primary shadow-sm" : "text-gray-600"}`}>{l}</button>)}</div>

      {tab === "stock" ? (
        <div className="card mt-4 overflow-hidden">
          <div className="flex flex-wrap gap-3 border-b p-4">
            <div className="relative min-w-[220px] flex-1"><Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select className="input w-auto" value={flt} onChange={(e) => setFlt(e.target.value)}><option value="">All stock levels</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="ok">Well stocked</option></select>
          </div>
          {prods.loading ? <PageLoader /> : prods.error ? <div className="p-4"><ErrorBox msg={prods.error} retry={prods.reload} /></div> : !list.length ? <Empty icon="inventory" title="No products match" /> : (
            <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[760px]">
              <thead className="bg-gray-50"><tr><th className="th">Product</th><th className="th">Category</th><th className="th">Stock</th><th className="th">Sold</th><th className="th">Value</th><th className="th text-right">Adjust</th></tr></thead>
              <tbody className="divide-y">{list.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50"><td className="td"><div className="flex items-center gap-3"><Thumb src={p.image} emoji={p.emoji} className="h-10 w-10" /><div><p className="max-w-[220px] truncate font-semibold">{p.name}</p><p className="text-xs text-gray-500">{p.unit}</p></div></div></td>
                  <td className="td text-gray-600">{catName(p.categoryId)}</td>
                  <td className="td"><StatusBadge status={p.stock <= 0 ? "out" : p.stock <= 10 ? "low" : "active"} label={p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`} /></td>
                  <td className="td text-gray-600">{p.sold}</td><td className="td text-gray-600">{taka(p.stock * p.price)}</td>
                  <td className="td text-right"><button className="btn-outline btn-sm" onClick={() => setAdj({ p, mode: "add", qty: "", reason: "" })}>Update stock</button></td></tr>))}</tbody></table></div>)}
        </div>
      ) : (
        <div className="card mt-4 overflow-hidden">
          {logs.loading ? <PageLoader /> : logs.error ? <div className="p-4"><ErrorBox msg={logs.error} retry={logs.reload} /></div> : !logs.data?.length ? <Empty icon="inventory" title="No stock movements yet" hint="Every manual stock change you make here is recorded." /> : (
            <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="bg-gray-50"><tr><th className="th">When</th><th className="th">Product</th><th className="th">Change</th><th className="th">Before → After</th><th className="th">Reason</th></tr></thead>
              <tbody className="divide-y">{logs.data.map((l) => <tr key={l.id}><td className="td whitespace-nowrap text-gray-500">{fmtDateTime(l.createdAt)}</td><td className="td font-medium">{l.productName}</td><td className={`td font-bold ${l.change >= 0 ? "text-emerald-600" : "text-red-600"}`}>{l.change > 0 ? "+" : ""}{l.change}</td><td className="td text-gray-600">{l.before} → {l.after}</td><td className="td text-gray-600">{l.reason}</td></tr>)}</tbody></table></div>)}
        </div>)}

      <Modal open={!!adj} onClose={() => !busy && setAdj(null)} title={adj ? `Update stock · ${adj.p.name}` : ""}
        footer={<><button className="btn-outline" onClick={() => setAdj(null)}>Cancel</button><button className="btn-primary" onClick={apply} disabled={busy || adj?.qty === ""}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {adj && <div className="space-y-4">
          <p className="rounded-lg bg-gray-50 p-3 text-sm">Current stock: <b>{adj.p.stock}</b> {adj.p.unit && <span className="text-gray-500">({adj.p.unit} per unit)</span>}</p>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-semibold">{modes.map(([m, l]) => <button key={m} onClick={() => setAdj({ ...adj, mode: m })} className={`flex-1 rounded-md px-2 py-1.5 ${adj.mode === m ? "bg-white text-primary shadow-sm" : "text-gray-600"}`}>{l}</button>)}</div>
          <Field label={adj.mode === "set" ? "New stock count" : "Quantity"}><input className="input" type="number" min="0" autoFocus value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value })} /></Field>
          <Field label="Reason (optional)"><input className="input" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Supplier delivery, damaged, expired, count…" /></Field>
        </div>}
      </Modal>
    </>
  );
}
