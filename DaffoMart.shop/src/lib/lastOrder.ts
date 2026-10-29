/** Persist last ordered items for homepage "Buy Again" (no login required). */
import type { OrderItem } from "./types";

const KEY = "daffomart-last-order";

export type LastOrderSnap = {
  orderNo: string;
  at: string;
  items: { id: string; variantId?: string; variantLabel?: string; name: string; price: number; unit: string; emoji?: string; image?: string; qty: number }[];
};

export function saveLastOrder(orderNo: string, items: OrderItem[]) {
  if (typeof window === "undefined" || !items?.length) return;
  const snap: LastOrderSnap = {
    orderNo,
    at: new Date().toISOString(),
    items: items.map((i) => ({
      id: i.id, ...(i.variantId ? { variantId: i.variantId, variantLabel: i.variantLabel } : {}), name: i.name, price: i.price, unit: i.unit,
      emoji: i.emoji, image: i.image, qty: i.qty,
    })),
  };
  try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* private mode */ }
}

export function loadLastOrder(): LastOrderSnap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as LastOrderSnap;
    if (!d?.items?.length) return null;
    return d;
  } catch { return null; }
}
