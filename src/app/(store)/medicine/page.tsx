import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/store/ProductCard";
import EmptyState from "@/components/store/EmptyState";
import { getActiveProducts, getCategories, getSettings } from "@/server/queries";
export const metadata: Metadata = { title: "Medicine & Healthcare", alternates: { canonical: "/medicine" } };

type SP = { q?: string; cat?: string; rx?: string; sort?: string };
export default async function MedicinePage({ searchParams }: { searchParams: Promise<SP> }) {
  const { q = "", cat = "", rx = "", sort = "" } = await searchParams;
  const [all, categories, s] = await Promise.all([getActiveProducts(), getCategories(), getSettings()]);
  if (!s.showMedicine) notFound();
  const medCats = categories.filter((c) => c.kind === "medicine"); const ids = new Set(medCats.map((c) => c.id));
  const needle = q.toLowerCase().trim();
  let list = all.filter((p) => ids.has(p.categoryId) && (!cat || p.categoryId === cat) && (!rx || (rx === "1" ? p.prescriptionRequired : !p.prescriptionRequired))
    && (!needle || `${p.name} ${p.genericName ?? ""} ${p.manufacturer ?? ""}`.toLowerCase().includes(needle)));
  if (sort === "price_asc") list.sort((a, b) => a.price - b.price); else if (sort === "price_desc") list.sort((a, b) => b.price - a.price); else list.sort((a, b) => a.name.localeCompare(b.name));
  const link = (o: Record<string, string>) => { const p = new URLSearchParams(Object.entries({ q, cat, rx, sort, ...o }).filter(([, v]) => v) as [string, string][]); const t = p.toString(); return `/medicine${t ? `?${t}` : ""}`; };
  const chip = (on: boolean) => `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${on ? "bg-emerald-600 text-white" : "bg-white text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50"}`;
  return (
    <div>
      <section className="rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-500 p-6 text-white shadow-card sm:p-9">
        <p className="text-sm font-semibold text-emerald-100">💊 {s.storeName} Pharmacy</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-4xl">{s.medicineTitle}</h1>
        {s.medicineSubtitle && <p className="mt-2 max-w-2xl text-emerald-50/90">{s.medicineSubtitle}</p>}
        <form action="/medicine" className="mt-5 flex max-w-xl gap-2"><input name="q" defaultValue={q} placeholder="Search medicine, generic name or company…" className="w-full rounded-full border-0 px-5 py-3 text-sm text-gray-900 outline-none ring-2 ring-transparent focus:ring-emerald-200" /><button className="btn bg-accent px-6 text-white hover:bg-accent-dark">Search</button></form>
      </section>
      {s.medicineNotice && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-100">ℹ️ {s.medicineNotice}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={link({ cat: "" })} className={chip(!cat)}>All</Link>{medCats.map((c) => <Link key={c.id} href={link({ cat: c.id })} className={chip(cat === c.id)}>{c.emoji} {c.name}</Link>)}
        <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" />
        <Link href={link({ rx: rx === "0" ? "" : "0" })} className={chip(rx === "0")}>No prescription needed</Link><Link href={link({ rx: rx === "1" ? "" : "1" })} className={chip(rx === "1")}>Rx only</Link>
      </div>
      <p className="mt-4 text-sm text-gray-500">{list.length} product{list.length === 1 ? "" : "s"}</p>
      {list.length === 0 ? <div className="mt-3"><EmptyState kind={ids.size && all.some((p) => ids.has(p.categoryId)) ? "search" : "none"} settings={s} actionHref="/medicine" /></div> :
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">{list.map((p) => <ProductCard key={p.id} p={p} whatsapp={s.whatsapp} />)}</div>}
    </div>
  );
}
