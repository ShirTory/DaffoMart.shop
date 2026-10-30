"use client";
import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { ErrorBox, Field, ImageUpload, PageHeader, PageLoader, Spinner, Toggle, useList, useToast } from "@/components/admin/ui";
import type { Category, Product, SeoEntry } from "@/lib/types";

const PAGES = [
  { key: "home", label: "Homepage", path: "/" }, { key: "products", label: "All products", path: "/products" }, { key: "offers", label: "Offers", path: "/products?sale=1" },
  { key: "contact", label: "Contact", path: "/contact" }, { key: "policy", label: "Return policy", path: "/policy" }, { key: "medicine", label: "Medicine", path: "/medicine" },
];
type Tab = "pages" | "categories" | "products";
type Form = { title: string; description: string; keywords: string; image: string; canonical: string; noindex: boolean };
const blank: Form = { title: "", description: "", keywords: "", image: "", canonical: "", noindex: false };
const SITE = typeof window !== "undefined" ? window.location.host : "daffomartshop.netlify.app";

function Meter({ n, good }: { n: number; good: [number, number] }) {
  const c = n === 0 ? "text-gray-400" : n < good[0] ? "text-amber-600" : n <= good[1] ? "text-emerald-600" : "text-red-600";
  return <span className={`text-xs font-semibold ${c}`}>{n} characters · aim for {good[0]}–{good[1]}</span>;
}

export default function SeoPage() {
  const toast = useToast();
  const seo = useList<SeoEntry[]>("/api/admin/seo");
  const cats = useList<Category[]>("/api/categories");
  const prodRes = useList<{ items: Product[] }>("/api/products?limit=500");
  const [tab, setTab] = useState<Tab>("pages"); const [q, setQ] = useState("");
  const [sel, setSel] = useState<{ key: string; label: string; path: string; autoTitle: string; autoDesc: string; autoImage?: string } | null>(null);
  const [f, setF] = useState<Form>(blank); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});

  const map = useMemo(() => new Map((seo.data ?? []).map((e) => [e.id, e])), [seo.data]);
  const items = useMemo(() => {
    if (tab === "pages") return PAGES.map((p) => ({ key: p.key, label: p.label, path: p.path, autoTitle: p.label, autoDesc: "", autoImage: undefined as string | undefined }));
    if (tab === "categories") return (cats.data ?? []).map((c) => ({ key: `category:${c.id}`, label: c.name, path: `/products?cat=${c.id}`, autoTitle: c.coverTitle || c.name, autoDesc: c.description || `Shop ${c.name}.`, autoImage: c.coverImage || c.image }));
    const needle = q.trim().toLowerCase();
    return (prodRes.data?.items ?? []).filter((p) => !needle || p.name.toLowerCase().includes(needle)).slice(0, 60).map((p) => ({ key: `product:${p.id}`, label: p.name, path: `/products/${p.slug}`, autoTitle: p.name, autoDesc: (p.description || "").replace(/\s+/g, " ").slice(0, 160), autoImage: p.image }));
  }, [tab, cats.data, prodRes.data, q]);

  const open = (it: NonNullable<typeof sel>) => { const e = map.get(it.key); setSel(it); setErrs({}); setF({ title: e?.title || "", description: e?.description || "", keywords: e?.keywords || "", image: e?.image || "", canonical: e?.canonical || "", noindex: e?.noindex === true }); };
  const save = async () => {
    if (!sel) return; setBusy(true); setErrs({});
    try { await api(`/api/admin/seo/${encodeURIComponent(sel.key)}`, { method: "PUT", body: f }); toast("SEO saved. It is live on the website now."); seo.reload(); }
    catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields || {}); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const reset = async () => { if (!sel) return; setBusy(true); try { await api(`/api/admin/seo/${encodeURIComponent(sel.key)}`, { method: "DELETE" }); setF(blank); toast("Back to automatic SEO"); seo.reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };

  const shownTitle = f.title.trim() || sel?.autoTitle || ""; const shownDesc = f.description.trim() || sel?.autoDesc || "";
  const url = `${SITE}${(f.canonical.trim() || sel?.path || "/").replace(/^https?:\/\/[^/]+/, "")}`.replace(/\/$/, "");
  const loading = seo.loading || cats.loading || prodRes.loading;

  return (
    <>
      <PageHeader title="SEO" subtitle="Control how each page appears on Google and when shared. Empty fields keep the automatic text. Changes go live immediately and the sitemap updates by itself." />
      {loading ? <PageLoader /> : seo.error ? <ErrorBox msg={seo.error} retry={seo.reload} /> : (
        <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
          <div className="card p-3">
            <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1 text-sm font-semibold">{(["pages", "categories", "products"] as Tab[]).map((t) => <button key={t} onClick={() => { setTab(t); setSel(null); }} className={`flex-1 rounded-lg px-2 py-1.5 capitalize ${tab === t ? "bg-white shadow-sm" : "text-gray-500"}`}>{t}</button>)}</div>
            {tab === "products" && <input className="input mb-2" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />}
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
              {items.map((it) => { const e = map.get(it.key); return (
                <li key={it.key}><button onClick={() => open(it)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 ${sel?.key === it.key ? "bg-primary-soft font-semibold" : ""}`}>
                  <span className="truncate">{it.label}</span>
                  {e?.noindex ? <span className="badge bg-red-100 text-red-700">noindex</span> : e ? <span className="badge bg-emerald-100 text-emerald-700">custom</span> : <span className="text-[11px] text-gray-400">auto</span>}
                </button></li>); })}
              {!items.length && <li className="p-3 text-sm text-gray-500">Nothing to show.</li>}
            </ul>
          </div>

          {!sel ? <div className="card flex items-center justify-center p-10 text-sm text-gray-500">Pick a page on the left to edit its SEO.</div> : (
            <div className="space-y-4">
              <div className="card space-y-4 p-5">
                <h2 className="font-bold">{sel.label}</h2>
                <Field label="SEO title" error={errs.title} hint={`Automatic: ${sel.autoTitle || "—"}`}><input className="input" maxLength={70} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Meter n={f.title.length} good={[30, 60]} /></Field>
                <Field label="Meta description" error={errs.description} hint={sel.autoDesc ? `Automatic: ${sel.autoDesc.slice(0, 90)}…` : "Empty = the automatic description"}><textarea className="input min-h-[80px]" maxLength={200} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /><Meter n={f.description.length} good={[110, 160]} /></Field>
                <Field label="Keywords (comma separated)" error={errs.keywords} hint="Optional. Google mostly ignores them; other search engines may use them."><input className="input" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></Field>
                <ImageUpload kind="general" label="Sharing image (Facebook, WhatsApp, Google)" aspect="aspect-[1.91/1]" fit="cover" value={f.image} onChange={(v) => setF({ ...f, image: v || "" })} />
                <Field label="Canonical URL" error={errs.canonical} hint="Leave empty unless this page duplicates another. Must be on this website."><input className="input" placeholder="/products/…" value={f.canonical} onChange={(e) => setF({ ...f, canonical: e.target.value })} /></Field>
                <Toggle checked={f.noindex} onChange={(v) => setF({ ...f, noindex: v })} label="Hide from Google (noindex) and remove from the sitemap" />
                <div className="flex gap-2"><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button><button className="btn-outline" onClick={reset} disabled={busy || !map.has(sel.key)}>Back to automatic</button></div>
              </div>
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Preview</h3>
                <div className="rounded-xl border bg-white p-4">
                  <p className="truncate text-xs text-gray-600">{url}</p>
                  <p className="mt-0.5 line-clamp-2 text-lg leading-snug text-[#1a0dab]">{shownTitle || "(no title)"}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{shownDesc || "(no description)"}</p>
                  {f.noindex && <p className="mt-2 text-xs font-semibold text-red-600">This page will NOT appear on Google.</p>}
                </div>
                <div className="mt-3 max-w-sm overflow-hidden rounded-xl border bg-white">
                  {(f.image || sel.autoImage) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.image || sel.autoImage} alt="" className="aspect-[1.91/1] w-full object-cover" /> : <div className="flex aspect-[1.91/1] items-center justify-center bg-gray-100 text-xs text-gray-400">Default store image</div>}
                  <div className="p-3"><p className="text-[11px] uppercase text-gray-500">{SITE}</p><p className="font-semibold leading-snug">{shownTitle}</p><p className="line-clamp-2 text-xs text-gray-600">{shownDesc}</p></div>
                </div>
                <p className="mt-3 text-xs text-gray-500">Google decides what to show and when. After big changes you can ask Google to re-crawl the page in Search Console → URL Inspection → Request indexing; indexing is never instant or guaranteed.</p>
              </div>
            </div>)}
        </div>)}
    </>
  );
}
