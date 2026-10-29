"use client";
import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, GalleryUpload, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Thumb, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { discountPct, taka } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { rollup, variantKey, variantLabel } from "@/lib/variants";

/** One editable size / weight / colour row (all strings while typing). */
type VRow = { id?: string; size: string; weight: string; color: string; colorHex: string; price: string; oldPrice: string; stock: string; sku: string };
const blankRow = (price = ""): VRow => ({ size: "", weight: "", color: "", colorHex: "", price, oldPrice: "", stock: "0", sku: "" });
type Form = { variants: VRow[];  offerStartsAt: string; offerEndsAt: string; name: string; sku: string; categoryId: string; price: string; oldPrice: string; unit: string; stock: string; description: string; emoji: string; images: string[]; featured: boolean; active: boolean; genericName: string; manufacturer: string; prescriptionRequired: boolean };
const blank = (cat = ""): Form => ({ variants: [], offerStartsAt: "", offerEndsAt: "", name: "", sku: "", categoryId: cat, price: "", oldPrice: "", unit: "1 kg", stock: "0", description: "", emoji: "🛒", images: [], featured: false, active: true, genericName: "", manufacturer: "", prescriptionRequired: false });

export default function ProductsPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const prods = useList<{ items: Product[] }>("/api/products?limit=500"); const cats = useList<Category[]>("/api/categories");
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [flt, setFlt] = useState("");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});

  const catName = (id: string) => cats.data?.find((c) => c.id === id)?.name ?? "—";
  const list = useMemo(() => (prods.data?.items ?? []).filter((p) =>
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase())) && (!cat || p.categoryId === cat) &&
    (!flt || (flt === "low" ? p.stock > 0 && p.stock <= 10 : flt === "out" ? p.stock <= 0 : flt === "hidden" ? !p.active : p.featured))), [prods.data, q, cat, flt]);

  const open = (p?: Product) => { setErrs({}); setEdit(p ? { id: p.id, f: { variants: (p.variants ?? []).map((v) => ({ id: v.id, size: v.size ?? "", weight: v.weight ?? "", color: v.color ?? "", colorHex: v.colorHex ?? "", price: String(v.price), oldPrice: v.oldPrice ? String(v.oldPrice) : "", stock: String(v.stock), sku: v.sku ?? "" })), offerStartsAt: p.offerStartsAt ?? "", offerEndsAt: p.offerEndsAt ?? "", name: p.name, sku: p.sku ?? "", categoryId: p.categoryId, price: String(p.price), oldPrice: p.oldPrice ? String(p.oldPrice) : "", unit: p.unit, stock: String(p.stock), description: p.description, emoji: p.emoji, images: p.images?.length ? p.images : p.image ? [p.image] : [], featured: p.featured, active: p.active, genericName: p.genericName ?? "", manufacturer: p.manufacturer ?? "", prescriptionRequired: !!p.prescriptionRequired } } : { f: blank(cats.data?.[0]?.id) }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));

  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    const f = edit.f; const isMed = cats.data?.find((c) => c.id === f.categoryId)?.kind === "medicine";
    const rows = f.variants.filter((r) => r.size.trim() || r.weight.trim() || r.color.trim());
    if (f.variants.length && !rows.length) { setBusy(false); setErrs({ variants: "Fill Size, Weight or Colour on each option, or remove the empty rows" }); return toast("Fill Size, Weight or Colour on each option", "err"); }
    if (rows.some((r) => r.price.trim() === "")) { setBusy(false); setErrs({ variants: "Enter a price for every option" }); return toast("Enter a price for every option", "err"); }
    const body = { variants: rows.map((r) => ({ id: r.id, size: r.size, weight: r.weight, color: r.color, colorHex: r.colorHex || undefined, price: r.price, oldPrice: r.oldPrice || undefined, stock: r.stock === "" ? 0 : r.stock, sku: r.sku || undefined })), offerStartsAt: f.offerStartsAt || undefined, offerEndsAt: f.offerEndsAt || undefined, name: f.name, sku: f.sku || undefined, categoryId: f.categoryId, price: rows.length ? String(rollup(rows.map((r) => ({ id: "x", price: Number(r.price) || 0, stock: Number(r.stock) || 0 }))).price) : f.price, oldPrice: f.oldPrice || undefined, unit: f.unit, stock: f.stock, description: f.description, emoji: f.emoji || "🛒", image: f.images[0], images: f.images, featured: f.featured, active: f.active, genericName: f.genericName || undefined, manufacturer: f.manufacturer || undefined, prescriptionRequired: isMed && f.prescriptionRequired };
    try {
      const saved = await api<Product>(edit.id ? `/api/products/${edit.id}` : "/api/products", { method: edit.id ? "PUT" : "POST", body, ...(edit.id ? {} : {}) });
      prods.setData((d) => ({ items: edit.id ? d!.items.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...(d?.items ?? [])] }));
      toast(edit.id ? "Product updated" : "Product added"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const backfillSku = async (apply: boolean) => {
    setBusy(true);
    try {
      const r = await api<{ count: number; plan: { name: string; sku: string }[]; apply: boolean }>("/api/admin/sku-backfill", { method: "POST", body: { apply, prefix: "DM" } });
      if (!apply) {
        toast(r.count ? `Preview: ${r.count} products need SKU` : "All active products have SKU");
        if (r.count) console.table(r.plan);
      } else {
        toast(`Applied ${r.count} SKUs`);
        prods.reload();
      }
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };
  const del = async (p: Product) => {
    if (!(await confirm(`Delete "${p.name}"? This cannot be undone.`))) return;
    try { await api(`/api/products/${p.id}`, { method: "DELETE" }); prods.setData((d) => ({ items: d!.items.filter((x) => x.id !== p.id) })); toast("Product deleted"); } catch (e: any) { toast(e.message, "err"); }
  };
  const quick = async (p: Product, patch: Partial<Product>) => {
    try { const s = await api<Product>(`/api/products/${p.id}`, { method: "PUT", body: { ...p, ...patch } }); prods.setData((d) => ({ items: d!.items.map((x) => (x.id === s.id ? s : x)) })); } catch (e: any) { toast(e.message, "err"); }
  };

  const f = edit?.f; const hasOpts = !!f && f.variants.length > 0;
  const derived = hasOpts ? rollup(f!.variants.map((r) => ({ id: "x", price: Number(r.price) || 0, stock: Number(r.stock) || 0, oldPrice: Number(r.oldPrice) || undefined }))) : null;
  const setRow = (i: number, patch: Partial<VRow>) => set("variants", f!.variants.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const variantErr = errs.variants || Object.entries(errs).find(([k]) => k.startsWith("variants."))?.[1];
  const dupKeys = f ? f.variants.map((r) => variantKey(r)).filter((k, i, a) => k !== "||" && a.indexOf(k) !== i) : [];
  // Quick generator: "S, M, L" x "Red, Blue" -> every combination that is not already there (price = first option / product price, stock 0)
  const [gen, setGen] = useState({ size: "", weight: "", color: "" });
  const list3 = (v: string) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 20);
  const generate = () => {
    if (!f) return; const S = list3(gen.size), W = list3(gen.weight), C = list3(gen.color);
    if (!S.length && !W.length && !C.length) return toast("Type some sizes, weights or colours, separated by commas", "err");
    const base = f.variants[0]?.price || f.price || ""; const have = new Set(f.variants.map((r) => variantKey(r))); const add: VRow[] = [];
    for (const size of S.length ? S : [""]) for (const weight of W.length ? W : [""]) for (const color of C.length ? C : [""]) {
      const row = { ...blankRow(String(base)), size, weight, color }; const k = variantKey(row);
      if (!have.has(k)) { have.add(k); add.push(row); }
    }
    if (f.variants.length + add.length > 40) return toast("A product can have at most 40 options", "err");
    set("variants", [...f.variants, ...add]); setGen({ size: "", weight: "", color: "" });
  };
  const medForm = !!f && cats.data?.find((c) => c.id === f.categoryId)?.kind === "medicine";
  return (
    <>
      <PageHeader title="Products" subtitle={`${prods.data?.items.length ?? 0} products in your catalogue`}>
        <button type="button" className="btn-outline" disabled={busy} onClick={() => backfillSku(false)}>Preview missing SKUs</button>
        <button type="button" className="btn-outline" disabled={busy} onClick={async () => { if (await confirm("Apply unique SKUs to all active products missing SKU? Existing SKUs are never changed.")) backfillSku(true); }}>Backfill SKUs</button>
        <button className="btn-primary" onClick={() => open()} disabled={!cats.data?.length}><Icon name="plus" className="h-4 w-4" />Add product</button>
      </PageHeader>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <div className="relative min-w-[220px] flex-1"><Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input w-auto" value={flt} onChange={(e) => setFlt(e.target.value)}><option value="">All status</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="hidden">Hidden</option><option value="featured">Featured</option></select>
        </div>
        {prods.loading ? <PageLoader /> : prods.error ? <div className="p-4"><ErrorBox msg={prods.error} retry={prods.reload} /></div> : list.length === 0 ? <Empty title="No products found" hint="Add your first product with photos, price and stock." action={<button className="btn-primary" onClick={() => open()}>Add product</button>} /> : (
          <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[860px]">
            <thead className="bg-gray-50"><tr><th className="th">Product</th><th className="th">SKU</th><th className="th">Category</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Visible</th><th className="th text-right">Actions</th></tr></thead>
            <tbody className="divide-y">{list.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="td"><div className="flex items-center gap-3"><Thumb src={p.image} emoji={p.emoji} className="h-12 w-12" /><div className="min-w-0"><p className="max-w-[240px] truncate font-semibold">{p.name} {p.featured && <span title="Featured" className="text-accent">★</span>}</p><p className="text-xs text-gray-500">{p.variants?.length ? `${p.variants.length} options (size / weight / colour)` : p.unit}</p></div></div></td>
                <td className="td font-mono text-xs text-gray-600">{p.sku || (p.active ? <span className="badge bg-amber-100 text-amber-800">Missing SKU</span> : <span className="text-gray-400">—</span>)}</td>
                <td className="td text-gray-600">{catName(p.categoryId)}</td>
                <td className="td">{p.variants?.length && Math.min(...p.variants.map((v) => v.price)) < Math.max(...p.variants.map((v) => v.price)) ? <span className="mr-1 text-xs text-gray-500">From</span> : null}<span className="font-semibold">{taka(p.price)}</span>{p.oldPrice ? <span className="ml-2 text-xs text-gray-400 line-through">{taka(p.oldPrice)}</span> : null}{discountPct(p.price, p.oldPrice) > 0 && <span className="ml-2 badge bg-accent-soft text-accent-dark">-{discountPct(p.price, p.oldPrice)}%</span>}</td>
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
              <Field label="SKU" error={errs.sku} hint="Required when Visible. Unique (e.g. DM-TOMATO-1KG)"><input className="input uppercase" value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="e.g. DM-TOMATO-1KG" maxLength={64} /></Field>
              <Field label="Category" error={errs.categoryId}><select className="input" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Select…</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.kind === "medicine" ? "💊 " : ""}{c.name}</option>)}</select></Field>
              <Field label="Unit" hint="e.g. 1 kg, 12 pcs, 500 ml"><input className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)} /></Field>
              <Field label="Price (৳)" error={errs.price} hint={hasOpts ? "Taken from the cheapest option below" : undefined}><input className="input" type="number" min="0" step="any" value={hasOpts ? String(derived?.price ?? "") : f.price} readOnly={hasOpts} onChange={(e) => set("price", e.target.value)} /></Field>
              {!hasOpts && <Field label="Old price (৳)" hint="Optional — shows a discount badge"><input className="input" type="number" min="0" step="any" value={f.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} /></Field>}
              <Field label="Offer starts" error={errs.offerStartsAt} hint="Optional. Offers carousel shows this product from this day"><input className="input" type="date" value={f.offerStartsAt} onChange={(e) => set("offerStartsAt", e.target.value)} /></Field>
              <Field label="Offer ends" error={errs.offerEndsAt} hint="Optional. Last day (inclusive). After it the product leaves the Offers carousel — also raise the price or clear the old price"><input className="input" type="date" value={f.offerEndsAt} onChange={(e) => set("offerEndsAt", e.target.value)} /></Field>
              <Field label="Stock quantity" error={errs.stock} hint={hasOpts ? "Total of all options below" : undefined}><input className="input" type="number" min="0" value={hasOpts ? String(derived?.stock ?? 0) : f.stock} readOnly={hasOpts} onChange={(e) => set("stock", e.target.value)} /></Field>
              <Field label="Fallback emoji" hint="Shown when no photo is added"><input className="input" value={f.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={8} /></Field>
              {medForm && <>
                <Field label="Generic name" hint="e.g. Paracetamol"><input className="input" value={f.genericName} onChange={(e) => set("genericName", e.target.value)} /></Field>
                <Field label="Manufacturer / company"><input className="input" value={f.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
                <div className="sm:col-span-2"><Toggle checked={f.prescriptionRequired} onChange={(v) => set("prescriptionRequired", v)} label="Prescription required (Rx)" /></div></>}
              <Field label="Description" className="sm:col-span-2"><textarea className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Short product description…" /></Field>
            </div>
            <fieldset className="space-y-3 rounded-xl border bg-gray-50 p-4">
              <legend className="px-1 text-sm font-bold">Options: size / weight / colour <span className="font-normal text-gray-500">(optional)</span></legend>
              <p className="text-xs text-gray-500">Add the choices customers can pick. Each option has its own price and stock, and the customer pays the price of the option they choose. Leave empty for a normal product.</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input className="input" placeholder="Sizes: S, M, L" value={gen.size} onChange={(e) => setGen({ ...gen, size: e.target.value })} aria-label="Sizes, comma separated" />
                <input className="input" placeholder="Weights: 500 g, 1 kg" value={gen.weight} onChange={(e) => setGen({ ...gen, weight: e.target.value })} aria-label="Weights, comma separated" />
                <input className="input" placeholder="Colours: Red, Blue" value={gen.color} onChange={(e) => setGen({ ...gen, color: e.target.value })} aria-label="Colours, comma separated" />
                <button type="button" className="btn-outline" onClick={generate}>Create options</button>
              </div>
              {hasOpts && <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="pb-1 pr-2 font-medium">Size</th><th className="pb-1 pr-2 font-medium">Weight</th><th className="pb-1 pr-2 font-medium">Colour</th><th className="pb-1 pr-2 font-medium">Swatch</th><th className="pb-1 pr-2 font-medium">Price ৳</th><th className="pb-1 pr-2 font-medium">Old ৳</th><th className="pb-1 pr-2 font-medium">Stock</th><th className="pb-1 pr-2 font-medium">SKU</th><th /></tr></thead>
                <tbody>{f.variants.map((r, i) => {
                  const dup = dupKeys.includes(variantKey(r));
                  return (
                    <tr key={r.id ?? `n${i}`} className={dup ? "bg-red-50" : ""}>
                      <td className="pr-2 pt-1"><input className="input" value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} maxLength={30} aria-label="Size" /></td>
                      <td className="pr-2 pt-1"><input className="input" value={r.weight} onChange={(e) => setRow(i, { weight: e.target.value })} maxLength={30} aria-label="Weight" /></td>
                      <td className="pr-2 pt-1"><input className="input" value={r.color} onChange={(e) => setRow(i, { color: e.target.value })} maxLength={30} aria-label="Colour" /></td>
                      <td className="pr-2 pt-1"><div className="flex items-center gap-1"><input type="color" className="h-10 w-10 rounded border bg-white p-1" value={r.colorHex || "#cccccc"} onChange={(e) => setRow(i, { colorHex: e.target.value })} aria-label="Colour swatch" />{r.colorHex && <button type="button" className="text-xs text-gray-500 underline" onClick={() => setRow(i, { colorHex: "" })}>clear</button>}</div></td>
                      <td className="pr-2 pt-1"><input className="input w-24" type="number" min="0" step="any" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} aria-label="Price" /></td>
                      <td className="pr-2 pt-1"><input className="input w-24" type="number" min="0" step="any" value={r.oldPrice} onChange={(e) => setRow(i, { oldPrice: e.target.value })} aria-label="Old price" /></td>
                      <td className="pr-2 pt-1"><input className="input w-20" type="number" min="0" value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} aria-label="Stock" /></td>
                      <td className="pr-2 pt-1"><input className="input w-32 uppercase" value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value.toUpperCase() })} maxLength={64} aria-label="Option SKU (optional)" /></td>
                      <td className="pt-1"><button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => set("variants", f.variants.filter((_, n) => n !== i))} aria-label={`Remove option ${variantLabel(r) || i + 1}`}><Icon name="trash" className="h-4 w-4" /></button></td>
                    </tr>);
                })}</tbody></table></div>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-outline btn-sm" onClick={() => set("variants", [...f.variants, blankRow(String(f.variants[0]?.price || f.price || ""))])} disabled={f.variants.length >= 40}><Icon name="plus" className="h-4 w-4" />Add one option</button>
                {hasOpts && <button type="button" className="text-xs font-medium text-red-600 underline" onClick={() => set("variants", [])}>Remove all options</button>}
                {dupKeys.length > 0 && <span className="text-xs font-semibold text-red-600">Two options have the same size / weight / colour</span>}
              </div>
              {variantErr && <p className="text-xs font-medium text-red-600">{variantErr}</p>}
            </fieldset>
            <div className="flex flex-wrap gap-6"><Toggle checked={f.active} onChange={(v) => set("active", v)} label="Visible in store" /><Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Featured on home page" /></div>
          </div>)}
      </Modal>
      {node}
    </>
  );
}
