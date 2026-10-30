"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, uploadImage } from "@/lib/api";
import { statusLabel } from "@/lib/format";

/* ---------- Icons (inline, no dependency) ---------- */
const P: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  orders: "M7 4h10l1 3H6l1-3zM5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8zm4 3v5m6-5v5",
  products: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5L12 12l8.7-4.5M12 12v9",
  categories: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 3.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z",
  covers: "M3 5h18v14H3V5zm0 11l5-5 4 4 3-3 6 6M8.5 9.5h.01",
  offers: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4A7.6 7.6 0 0 0 7.7 6.7l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z",
  plus: "M12 5v14M5 12h14", search: "M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z", x: "M6 6l12 12M18 6L6 18",
  edit: "M4 20h4L19 9l-4-4L4 16v4zm9.5-13.5l4 4", trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  upload: "M12 16V4m0 0L7 9m5-5l5 5M4 20h16", menu: "M4 6h16M4 12h16M4 18h16", out: "M15 17l5-5-5-5m5 5H9m4 8H5V4h8",
  external: "M14 4h6v6m0-6L10 14M18 14v6H4V6h6", check: "M5 13l4 4L19 7", alert: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  print: "M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7z", phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  calendar: "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 8l2 2 4-4",
  palette: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s-.5-2 1-2H17a4 4 0 0 0 4-4c0-5-4-10-9-10zM7.5 11h.01M10 7.5h.01M15 7.5h.01",
  text: "M4 6h16M4 12h10M4 18h16",
  invoice: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6m-6 4h6",
  ops: "M3 12h4l3-8 4 16 3-8h4",
  inventory: "M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0l9 4m0 0l9-4m-9 4v10M7.5 5l9 4",
  delivery: "M1 6h13v10H1V6zm13 4h4l3 3v3h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  rider: "M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 22v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3M3 12h3m12 0h3",
  content: "M4 4h16v16H4V4zm0 5h16M9 9v11",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6", users: "M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", cash: "M3 6h18v12H3V6zm9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};
export const Icon = ({ name, className = "h-5 w-5" }: { name: keyof typeof P | string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={P[name] ?? ""} /></svg>
);
export const Spinner = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" /><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
);

/* ---------- Toasts ---------- */
type Toast = { id: number; msg: string; type: "ok" | "err" };
const ToastCtx = createContext<(msg: string, type?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random(); setList((l) => [...l, { id, msg, type }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {list.map((t) => (
          <div key={t.id} className={`fade-in pointer-events-auto flex items-start gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-pop ${t.type === "ok" ? "bg-emerald-600" : "bg-red-600"}`}>
            <Icon name={t.type === "ok" ? "check" : "alert"} className="mt-0.5 h-4 w-4 shrink-0" /><span>{t.msg}</span>
          </div>))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Data hook ---------- */
export function useList<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!url) return; setError("");
    try { setData(await api<T>(url)); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [url]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  return { data, setData, loading, error, reload: load };
}

/* ---------- Layout bits ---------- */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>{subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
export const Empty = ({ icon = "products", title, hint, action }: { icon?: string; title: string; hint?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center px-6 py-14 text-center">
    <div className="mb-3 rounded-full bg-primary-soft p-3 text-primary"><Icon name={icon} className="h-6 w-6" /></div>
    <p className="font-semibold text-gray-800">{title}</p>{hint && <p className="mt-1 max-w-sm text-sm text-gray-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}
  </div>
);
export const PageLoader = () => <div className="flex justify-center py-24 text-primary"><Spinner className="h-8 w-8" /></div>;
export const ErrorBox = ({ msg, retry }: { msg: string; retry?: () => void }) => (
  <div className="card flex items-center justify-between gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{msg}</span>{retry && <button className="btn-outline btn-sm" onClick={retry}>Retry</button>}</div>
);

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", confirmed: "bg-blue-100 text-blue-800", processing: "bg-indigo-100 text-indigo-800", assigned: "bg-violet-100 text-violet-800",
  picked_up: "bg-cyan-100 text-cyan-800", on_the_way: "bg-sky-100 text-sky-800", delivered: "bg-emerald-100 text-emerald-800", cancelled: "bg-red-100 text-red-700", returned: "bg-gray-200 text-gray-700",
  live: "bg-emerald-100 text-emerald-800", scheduled: "bg-blue-100 text-blue-800", expired: "bg-gray-200 text-gray-700", inactive: "bg-gray-200 text-gray-600",
  active: "bg-emerald-100 text-emerald-800", low: "bg-amber-100 text-amber-800", out: "bg-red-100 text-red-700",
};
export const StatusBadge = ({ status, label }: { status: string; label?: string }) => <span className={`badge ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700"}`}>{label ?? statusLabel(status)}</span>;

export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-primary" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>{label && <span className="text-gray-700">{label}</span>}
    </label>
  );
}

export function Field({ label, error, hint, children, className = "" }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="label">{label}</label>{children}{hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`fade-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
        <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-base font-bold">{title}</h2><button onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label="Close"><Icon name="x" /></button></div>
        <div className="scroll-thin overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-3 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function useConfirm() {
  const [st, setSt] = useState<{ msg: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = (msg: string) => new Promise<boolean>((resolve) => setSt({ msg, resolve }));
  const close = (v: boolean) => { st?.resolve(v); setSt(null); };
  const node = (
    <Modal open={!!st} onClose={() => close(false)} title="Please confirm" footer={<><button className="btn-outline" onClick={() => close(false)}>Cancel</button><button className="btn-danger" onClick={() => close(true)}>Yes, continue</button></>}>
      <p className="text-sm text-gray-700">{st?.msg}</p>
    </Modal>
  );
  return { confirm, node };
}

/* ---------- Image upload (drag & drop, file picker, or URL) ---------- */
export function ImageUpload({ value, onChange, kind, label = "Image", hint, aspect = "aspect-square", rounded = "rounded-xl", allowUrl = false, fit = "cover" }: {
  value?: string; onChange: (url: string | undefined) => void; kind: "product" | "banner" | "category" | "offer" | "general"; label?: string; hint?: string; aspect?: string; rounded?: string;
  /** Also let the admin paste a link (handy for large GIFs hosted elsewhere, e.g. Cloudinary, Giphy, your own CDN). */
  allowUrl?: boolean; fit?: "cover" | "contain";
}) {
  const toast = useToast(); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false); const [link, setLink] = useState("");
  const applyLink = () => {
    const v = link.trim();
    if (!/^https:\/\//i.test(v) && !v.startsWith("/")) return toast("Paste a full link that starts with https://", "err");
    onChange(v); setLink(""); toast("Image link added");
  };
  const pick = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Please choose an image file", "err");
    setBusy(true);
    try { onChange(await uploadImage(f, kind)); toast("Image uploaded"); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  return (
    <div>
      <label className="label">{label}</label>
      <div className={`relative flex ${aspect} w-full items-center justify-center overflow-hidden border-2 border-dashed ${rounded} transition ${drag ? "border-primary bg-primary-soft" : "border-gray-300 bg-gray-50"}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
        {value ? (
          <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={value} alt="" className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`} />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
              <button type="button" className="btn-sm btn bg-white text-gray-800 hover:bg-gray-100" onClick={() => input.current?.click()}>Replace</button>
              <button type="button" className="btn-sm btn bg-red-600 text-white hover:bg-red-700" onClick={() => onChange(undefined)}>Remove</button>
            </div></>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-gray-500 hover:text-primary">
            <Icon name="upload" className="h-7 w-7" /><span className="text-sm font-semibold">Click to upload</span><span className="text-xs">or drag &amp; drop · JPG, PNG, WebP, GIF (max 4 MB)</span>
          </button>)}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-primary"><Spinner className="h-7 w-7" /></div>}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {allowUrl && (
        <div className="mt-2 flex gap-2">
          <input className="input h-9 text-xs" value={link} placeholder="…or paste an image / GIF link (https://…)" onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }} aria-label={`${label} link`} />
          <button type="button" className="btn-outline btn-sm shrink-0" onClick={applyLink} disabled={!link.trim()}>Use link</button>
        </div>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export function GalleryUpload({ value, onChange, kind = "product", max = 6 }: { value: string[]; onChange: (v: string[]) => void; kind?: "product"; max?: number }) {
  const toast = useToast(); const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(0);
  const add = async (files: FileList | null) => {
    if (!files) return; const room = max - value.length; const list = Array.from(files).slice(0, room);
    if (files.length > room) toast(`Only ${max} images allowed per product`, "err");
    setBusy(list.length); const urls: string[] = [];
    for (const f of list) { try { urls.push(await uploadImage(f, kind)); } catch (e: any) { toast(`${f.name}: ${e.message}`, "err"); } setBusy((b) => b - 1); }
    if (urls.length) onChange([...value, ...urls]); if (input.current) input.current.value = "";
  };
  const move = (i: number, d: number) => { const a = [...value]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div>
      <label className="label">Product images <span className="font-normal normal-case text-gray-400">(first image is the main photo)</span></label>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((u, i) => (
          <div key={u} className="group relative aspect-square overflow-hidden rounded-xl border bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">MAIN</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 opacity-0 transition group-hover:opacity-100">
              <div className="flex gap-1"><button type="button" onClick={() => move(i, -1)} className="rounded bg-white/90 px-1.5 text-xs">←</button><button type="button" onClick={() => move(i, 1)} className="rounded bg-white/90 px-1.5 text-xs">→</button></div>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== u))} className="rounded bg-red-600 px-1.5 text-xs text-white">✕</button>
            </div>
          </div>))}
        {Array.from({ length: busy }).map((_, i) => <div key={i} className="flex aspect-square items-center justify-center rounded-xl border bg-gray-50 text-primary"><Spinner /></div>)}
        {value.length + busy < max && (
          <button type="button" onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-primary hover:text-primary">
            <Icon name="plus" className="h-6 w-6" /><span className="text-xs font-semibold">Add photo</span>
          </button>)}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
    </div>
  );
}

export const Thumb = ({ src, emoji, className = "h-10 w-10" }: { src?: string; emoji?: string; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  src ? <img src={src} alt="" className={`${className} shrink-0 rounded-lg border object-cover`} /> : <div className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-primary-soft text-lg`}>{emoji ?? "🛒"}</div>
);
