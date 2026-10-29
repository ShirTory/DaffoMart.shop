"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Offer = { id: string; title: string; description?: string; badge?: string; code?: string; endsAt?: string };

/** Bell in the header. It inherits the header's text colour (white on a dark header, dark on a light one) and shows how many offers are live. */
export default function NotificationBell({ announcement }: { announcement?: string }) {
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  useEffect(() => {
    api<Offer[]>("/api/offers").then(setOffers).catch(() => {});
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const items = [
    ...(announcement ? [{ id: "ann", title: announcement, kind: "news" as const }] : []),
    ...offers.slice(0, 8).map((o) => ({ id: o.id, title: o.title, desc: o.description, code: o.code, kind: "offer" as const })),
  ];
  const n = items.length;
  return (
    <div className="relative">
      <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[var(--h-hover)]" aria-label={n ? `Notifications, ${n} new` : "Notifications"} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {n > 0 && <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[color:var(--h-bg)]">{n > 9 ? "9+" : n}</span>}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-pop">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-bold">Offers &amp; updates</p>
              {n > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-dark">{n} new</span>}
            </div>
            {items.length === 0 ? (
              <p className="p-5 text-center text-sm text-gray-500">No offers right now. Check back soon.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
                {items.map((i) => (
                  <li key={i.id} className="px-4 py-3 text-sm">
                    <p className="font-semibold text-gray-900">{i.title}</p>
                    {"desc" in i && i.desc && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{i.desc}</p>}
                    {"code" in i && i.code && <p className="mt-1.5 inline-block rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-primary">{i.code}</p>}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/products?sale=1" className="block border-t border-gray-100 bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-primary-soft" onClick={() => setOpen(false)}>
              See all offers
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
