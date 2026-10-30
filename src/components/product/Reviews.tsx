"use client";
import { useRef, useState } from "react";

export interface PublicReview { id: string; name: string; rating: number; title?: string; text: string; images: string[]; verified: true; createdAt: string }
export interface ReviewsData { items: PublicReview[]; total: number; stats: { count: number; average: number; dist: number[] } }

export function Stars({ value, size = "text-base", label }: { value: number; size?: string; label?: string }) {
  return <span className={`inline-flex ${size} leading-none text-amber-400`} role="img" aria-label={label ?? `${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= Math.round(value) ? "" : "text-gray-300"}>★</span>)}</span>;
}
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function Reviews({ productId, data, preview = false }: { productId: string; data: ReviewsData; preview?: boolean }) {
  const [items, setItems] = useState(data.items); const [total, setTotal] = useState(data.total); const [stats] = useState(data.stats);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0); const [form, setForm] = useState({ orderNo: "", phone: "", title: "", text: "" }); const [files, setFiles] = useState<File[]>([]); const [formErr, setFormErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null); const [zoom, setZoom] = useState<string | null>(null);

  const more = async () => {
    setLoading(true); setErr("");
    try { const r = await fetch(`/api/products/${productId}/reviews?offset=${items.length}&limit=5`); const j = await r.json(); if (!r.ok) throw new Error(j?.error || "Could not load reviews"); const d = j.data ?? j; setItems((x) => [...x, ...d.items.filter((n: PublicReview) => !x.some((o) => o.id === n.id))]); setTotal(d.total); }
    catch (e: any) { setErr(e.message || "Could not load reviews"); } finally { setLoading(false); }
  };
  const pick = (list: FileList | null) => {
    const f = Array.from(list ?? []).slice(0, 3); setFormErr("");
    if (f.some((x) => !/^image\/(jpeg|png|webp)$/.test(x.type))) return setFormErr("Photos must be JPG, PNG or WebP.");
    if (f.some((x) => x.size > 1.5 * 1024 * 1024)) return setFormErr("Each photo must be under 1.5 MB.");
    setFiles(f);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormErr("");
    if (preview) return setFormErr("Reviews cannot be submitted from the preview.");
    if (!rating) return setFormErr("Choose a star rating.");
    setBusy(true);
    try {
      const fd = new FormData(); fd.set("orderNo", form.orderNo); fd.set("phone", form.phone); fd.set("rating", String(rating)); fd.set("title", form.title); fd.set("text", form.text); files.forEach((f) => fd.append("images", f));
      const r = await fetch(`/api/products/${productId}/reviews`, { method: "POST", body: fd }); const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Could not send your review");
      setDone(true);
    } catch (e: any) { setFormErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      {stats.count > 0 ? (
        <div className="grid gap-6 rounded-2xl border bg-white p-5 sm:grid-cols-[200px_1fr]">
          <div className="text-center sm:border-r sm:pr-6"><p className="text-5xl font-extrabold text-gray-900">{stats.average.toFixed(1)}</p><Stars value={stats.average} size="text-xl" /><p className="mt-1 text-sm text-gray-500">{stats.count} review{stats.count === 1 ? "" : "s"}</p></div>
          <ul className="space-y-1.5" aria-label="Rating distribution">{[5, 4, 3, 2, 1].map((s) => { const c = stats.dist[s - 1] || 0, pct = stats.count ? Math.round((c / stats.count) * 100) : 0; return (
            <li key={s} className="flex items-center gap-3 text-sm"><span className="w-9 shrink-0 text-gray-600">{s} ★</span><span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></span><span className="w-10 shrink-0 text-right text-gray-500">{c}</span></li>); })}</ul>
        </div>) : <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-gray-500">No reviews yet. Bought this product? Be the first to share your experience.</p>}

      {items.length > 0 && <ul className="mt-5 space-y-4">{items.map((r) => (
        <li key={r.id} className="rounded-2xl border bg-white p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Stars value={r.rating} /><span className="text-sm font-semibold">{r.name}</span><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Verified purchase</span><span className="text-xs text-gray-400">{when(r.createdAt)}</span></div>
          {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">{r.text}</p>
          {r.images.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{r.images.map((u) => (<button key={u} type="button" onClick={() => setZoom(u)} className="h-16 w-16 overflow-hidden rounded-lg border" aria-label="View review photo">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="Customer photo" loading="lazy" className="h-full w-full object-cover" /></button>))}</div>}
        </li>))}</ul>}
      {items.length < total && <div className="mt-4 text-center"><button type="button" className="btn-outline" onClick={more} disabled={loading}>{loading ? "Loading…" : `Load more reviews (${total - items.length})`}</button>{err && <p className="mt-2 text-sm text-red-600" role="alert">{err}</p>}</div>}

      <div className="mt-6 rounded-2xl border bg-white p-5">
        {done ? <p className="text-center font-semibold text-emerald-700" role="status">Thank you! Your review was received and will appear once it has been approved.</p> : !open ? (
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-600">Received this product? Tell other customers what you think.</p><button type="button" className="btn-primary" onClick={() => setOpen(true)}>Write a review</button></div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <p className="text-sm text-gray-600">To keep reviews genuine, enter the order number and phone number from your <b>delivered</b> order.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Order number<input className="input mt-1" value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })} placeholder="e.g. DM-12345" autoComplete="off" required /></label>
              <label className="text-sm font-medium">Phone number<input className="input mt-1" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" autoComplete="tel" required /></label>
            </div>
            <div><p className="text-sm font-medium">Your rating</p><div className="mt-1 flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((s) => <button key={s} type="button" role="radio" aria-checked={rating === s} aria-label={`${s} star${s > 1 ? "s" : ""}`} onClick={() => setRating(s)} className={`text-3xl leading-none transition ${s <= rating ? "text-amber-400" : "text-gray-300 hover:text-amber-300"}`}>★</button>)}</div></div>
            <label className="block text-sm font-medium">Headline <span className="font-normal text-gray-400">(optional)</span><input className="input mt-1" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="block text-sm font-medium">Your review<textarea className="input mt-1" rows={4} minLength={10} maxLength={1500} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required /></label>
            <div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => pick(e.target.files)} /><button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()}>Add photos (max 3)</button>{files.length > 0 && <span className="ml-2 text-xs text-gray-500">{files.length} selected</span>}</div>
            {formErr && <p className="text-sm font-medium text-red-600" role="alert">{formErr}</p>}
            <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Submit review"}</button><button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button></div>
          </form>)}
      </div>
      {zoom && <div role="dialog" aria-modal="true" aria-label="Review photo" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={zoom} alt="Customer photo" className="max-h-full max-w-full rounded-lg object-contain" /></div>}
    </div>
  );
}
