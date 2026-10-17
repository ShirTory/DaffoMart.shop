"use client";
import { useEffect, useState } from "react";

/**
 * Products page layout. Desktop: filters in a left column. Mobile: filters live in a drawer that slides in from the LEFT,
 * so the products are the first thing visitors see instead of a long block of filter chips.
 */
export default function FilterLayout({ filters, children, count = 0, label = "Filters", title = "Filters", doneLabel = "Show results" }: { filters: React.ReactNode; children: React.ReactNode; count?: number; label?: string; title?: string; doneLabel?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      {open && <div className="fixed inset-0 z-[60] bg-black/45 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={title}
        className={`fixed inset-y-0 left-0 z-[70] flex w-[86%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:block lg:h-fit lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-2xl lg:border lg:shadow-card lg:sticky lg:top-40 ${open ? "translate-x-0" : "-translate-x-full"}`}
        onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <p className="text-base font-bold">{title}</p>
          <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={() => setOpen(false)} aria-label="Close filters">✕</button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 text-sm lg:overflow-visible">{filters}</div>
        <div className="border-t p-3 lg:hidden"><button type="button" className="btn-primary w-full" onClick={() => setOpen(false)}>{doneLabel}</button></div>
      </aside>

      <div className="min-w-0">
        <div className="mb-3 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold shadow-sm active:scale-95" aria-haspopup="dialog">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 6h18M6 12h12M10 18h4" /></svg>
            {label}
            {count > 0 && <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">{count}</span>}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
