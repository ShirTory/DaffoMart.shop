"use client";
import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, GalleryUpload, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Thumb, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { discountPct, taka } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

type Form = { name: string; categoryId: string; price: string; oldPrice: string; unit: string; stock: string; description: string; emoji: string; images: string[]; featured: boolean; active: boolean; genericName: string; manufacturer: string; prescriptionRequired: boolean };
const blank = (cat = ""): Form => ({ name: "", categoryId: cat, price: "", oldPrice: "", unit: "1 kg", stock: "0", description: "", emoji: "🛒", images: [], featured: false, active: true, genericName: "", manufacturer: "", prescriptionRequired: false });

export default function ProductsPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const prods = useList<{ items: Product[] }>("/api/products?limit=500"); const cats = useList<Category[]>("/api/categories");
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [flt, setFlt] = useState("");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});

  const catName = (id: string) => cats.data?.find((c) => c.id === id)?.name ?? "—";
  const list = useMemo(() => (prods.data?.items ?? []).filter((p) =>
    (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!cat || p.categoryId === cat) &&
    (!flt || (flt === "low" ? p.stock > 0 && p.stock <= 10 : flt === "out" ? p.stock <= 0 : flt === "hidden" ? !p.active : p.featured))), [prods.data, q, cat, flt]);

  const open = (p?: Product) => { setErrs({}); setEdit(p ? { id: p.id, f: { name: p.name, categoryId: p.categoryId, price: String(p.price), oldPrice: p.oldPrice ? String(p.oldPrice) : "", unit: p.unit, stock: String(p.stock), description: p.description, emoji: p.emoji, images: p.images?.length ? p.images : p.image ? [p.image] : [], featured: p.featured, active: p.active, genericName: p.genericName ?? "", manufacturer: p.manufacturer ?? "", prescriptionRequired: !!p.prescriptionRequired } } : { f: blank(cats.data?.[0]?.id) }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));

  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    const f = edit.f; const isMed = cats.data?.find((c) => c.id === f.categoryId)?.kind === "medicine";
    const body = { name: f.name, categoryId: f.categoryId, price: f.price, oldPrice: f.oldPrice || undefined, unit: f.unit, stock: f.stock, description: f.description, emoji: f.emoji || "🛒", image: f.images[0], images: f.images, featured: f.featured, active: f.active, genericName: f.genericName || undefined, manufacturer: f.manufacturer || undefined, prescriptionRequired: isMed && f.prescriptionRequired };
    try {
      const saved = await api<Product>(edit.id ? `/api/products/${edit.id}` : "/api/products", { method: edit.id ? "PUT" : "POST", body, ...(edit.id ? {} : {}) });
      prods.setData((d) => ({ items: edit.id ? d!.items.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...(d?.items ?? [])] }));
      toast(edit.id ? "Product updated" : "Product added"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (p: Product) => {
    if (!(await confirm(`Delete "${p.name}"? This cannot be undone.`))) return;
    try { await api(`/api/products/${p.id}`, { method: "DELETE" }); prods.setData((d) => ({ items: d!.items.filter((x) => x.id !== p.id) })); toast("Product deleted"); } catch (e: any) { toast(e.message, "err"); }
  };
  const quick = async (p: Product, patch: Partial<Product>) => {
    try { const s = await api<Product>(`/api/products/${p.id}`, { method: "PUT", body: { ...p, ...patch } }); prods.setData((d) => ({ items: d!.items.map((x) => (x.id === s.id ? s : x)) })); } catch (e: any) { toast(e.message, "err"); }
  };

  const f = edit?.f; const medForm = !!f && cats.data?.find((c) => c.id === f.categoryId)?.kind === "medicine";
  return (
    <>
      <PageHeader title="Products" subtitle={`${prods.data?.items.length ?? 0} products in your catalogue`}><button className="btn-primary" onClick={() => open()} disabled={!cats.data?.length}><Icon name="plus" className="h-4 w-4" />Add product</button></PageHeader>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <div className="relative min-w-[220px] flex-1"><Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input w-auto" value={flt} onChange={(e) => setFlt(e.target.value)}><option value="">All status</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="hidden">Hidden</option><option value="featured">Featured</option></select>
        </div>
        {prods.loading ? <PageLoader /> : prods.error ? <div className="p-4"><ErrorBox msg={prods.error} retry={prods.reload} /></div> : list.length === 0 ? <Empty title="No products found" hint="Add your first product with photos, price and stock." action={<button className="btn-primary" onClick={() => open()}>Add product</button>} /> : (
          <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[860px]">
            <thead className="bg-gray-50"><tr><th className="th">Product</th><th className="th">Category</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Visible</th><th className="th text-right">Actions</th></tr></thead>
            <tbody className="divide-y">{list.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="td"><div className="flex items-center gap-3"><Thumb src={p.image} emoji={p.emoji} className="h-12 w-12" /><div className="min-w-0"><p className="max-w-[240px] truncate font-semibold">{p.name} {p.featured && <span title="Featured" className="text-accent">★</span>}</p><p className="text-xs text-gray-500">{p.unit}</p></div></div></td>
                <td className="td text-gray-600">{catName(p.categoryId)}</td>
                <td className="td"><span className="font-semibold">{taka(p.price)}</span>{p.oldPrice ? <span className="ml-2 text-xs text-gray-400 line-through">{taka(p.oldPrice)}</span> : null}{discountPct(p.price, p.oldPrice) > 0 && <span className="ml-2 badge bg-accent-soft text-accent-dark">-{discountPct(p.price, p.oldPrice)}%</span>}</td>
                <td className="td"><StatusBadge status={p.stock <= 0 ? "out" : p.stock <= 10 ? "low" : "active"} label={p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`} /></td>
                <td className="td"><Toggle checked={p.active} onChange={(v) => quick(p, { active: v })} /></td>
                <td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => open(p)} aria-label="Edit"><Icon name="edit" className="h-4 w-4" /></button><button className="btn-ghost btn-sm text-red-600" onClick={() => del(p)} aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></button></td>
              </tr>))}</tbody></table></div>)}
      </div>

      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit product" : "Add product"} wide
        footer={<><button className="btn-outline" onClick={() => setEdit(null)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{edit?.id ? "Save changes" : "Add product"}</button></>}>
        {f && (
          <div className="space-y-5">
            <GalleryUpload value={f.images} onChange={(v) => set("images", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name" error={errs.name} className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Fresh Tomato" /></Field>
              <Field label="Category" error={errs.categoryId}><select className="input" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Select…</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.kind === "medicine" ? "💊 " : ""}{c.name}</option>)}</select></Field>
              <Field label="Unit" hint="e.g. 1 kg, 12 pcs, 500 ml"><input className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)} /></Field>
              <Field label="Price (৳)" error={errs.price}><input className="input" type="number" min="0" step="any" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
              <Field label="Old price (৳)" hint="Optional — shows a discount badge"><input className="input" type="number" min="0" step="any" value={f.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} /></Field>
              <Field label="Stock quantity" error={errs.stock}><input className="input" type="number" min="0" value={f.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
              <Field label="Fallback emoji" hint="Shown when no photo is added"><input className="input" value={f.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={8} /></Field>
              {medForm && <>
                <Field label="Generic name" hint="e.g. Paracetamol"><input className="input" value={f.genericName} onChange={(e) => set("genericName", e.target.value)} /></Field>
                <Field label="Manufacturer / company"><input className="input" value={f.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
                <div className="sm:col-span-2"><Toggle checked={f.prescriptionRequired} onChange={(v) => set("prescriptionRequired", v)} label="Prescription required (Rx)" /></div></>}
              <Field label="Description" className="sm:col-span-2"><textarea className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Short product description…" /></Field>
            </div>
            <div className="flex flex-wrap gap-6"><Toggle checked={f.active} onChange={(v) => set("active", v)} label="Visible in store" /><Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Featured on home page" /></div>
          </div>)}
      </Modal>
      {node}
    </>
  );
}
