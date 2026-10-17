"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Offer = { id: string; title: string; description?: string; badge?: string; code?: string; endsAt?: string };

export default function NotificationBell({ announcement }: { announcement?: string }) {
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  useEffect(() => {
    api<Offer[]>("/api/offers").then(setOffers).catch(() => {});
  }, []);
  const items = [
    ...(announcement ? [{ id: "ann", title: announcement, kind: "news" as const }] : []),
    ...offers.slice(0, 8).map((o) => ({ id: o.id, title: o.title, desc: o.description, code: o.code, kind: "offer" as const })),
  ];
  const n = items.length;
  return (
    <div className="relative">
      <button type="button" className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {n > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white shadow-pop">
            <div className="border-b px-4 py-2.5 text-sm font-bold">Notifications</div>
            {items.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No offers right now.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {items.map((i) => (
                  <li key={i.id} className="border-b px-4 py-3 text-sm last:border-0">
                    <p className="font-semibold text-gray-900">{i.kind === "offer" ? "🔥 " : "📢 "}{i.title}</p>
                    {"desc" in i && i.desc && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{i.desc}</p>}
                    {"code" in i && i.code && <p className="mt-1 text-xs font-mono text-primary">Code: {i.code}</p>}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/products?sale=1" className="block border-t px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary-soft" onClick={() => setOpen(false)}>
              View all offers →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
