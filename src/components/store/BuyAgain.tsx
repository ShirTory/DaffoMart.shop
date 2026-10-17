"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadLastOrder, type LastOrderSnap } from "@/lib/lastOrder";
import { useCart } from "@/lib/store";
import { taka } from "@/lib/format";

export default function BuyAgain() {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [snap, setSnap] = useState<LastOrderSnap | null>(null);

  useEffect(() => { setSnap(loadLastOrder()); }, []);

  if (!snap) return null;

  const reorder = () => {
    for (const i of snap.items) {
      add({ id: i.id, slug: i.id, name: i.name, price: i.price, unit: i.unit, emoji: i.emoji || "🛒", image: i.image }, i.qty);
    }
    router.push("/cart");
  };

  const preview = snap.items.slice(0, 4);
  const more = snap.items.length - preview.length;

  return (
    <section className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary-soft to-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Buy again</p>
          <p className="text-sm font-semibold text-gray-900">Reorder {snap.orderNo}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
            {preview.map((i) => i.name).join(", ")}
            {more > 0 ? ` +${more} more` : ""}
          </p>
        </div>
        <button type="button" onClick={reorder} className="btn-primary btn-sm shrink-0 px-5">
          Reorder · {taka(snap.items.reduce((s, i) => s + i.price * i.qty, 0))}
        </button>
      </div>
    </section>
  );
}
