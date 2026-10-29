"use client";
import { useEffect, useState } from "react";

/** false during SSR and the first client render, true afterwards: gate anything that reads persisted (localStorage) state. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
import { create } from "zustand";
import { api } from "./api";
import { useCart } from "./store";
import type { CartItem, Product } from "./types";
import { findVariant, hasVariants, variantLabel } from "./variants";

/** Messages about cart lines the server removed or reduced during the last sync (shown by <CartNotice/>). */
export const useCartNotice = create<{ messages: string[]; set: (m: string[]) => void }>((set) => ({ messages: [], set: (messages) => set({ messages }) }));

/** Refreshes prices/stock/images of cart lines from the server and drops products that no longer exist. */
export function useCartSync() {
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ids = useCart.getState().items.map((i) => i.id);
        if (!ids.length) { if (alive) setSynced(true); return; }
        const { items } = await api<{ items: Product[] }>(`/api/products?ids=${ids.map(encodeURIComponent).join(",")}&limit=100`);
        const map = new Map(items.map((p) => [p.id, p]));
        const messages: string[] = [];
        // the stock and price that apply to a cart line: the chosen variant's when the product has variants, else the product's
        const resolve = (i: CartItem) => {
          const p = map.get(i.id); if (!p) return null;
          if (hasVariants(p)) { const v = findVariant(p, i.vid); return v ? { p, price: v.price, stock: v.stock, unit: variantLabel(v) } : null; }
          return i.vid ? null : { p, price: p.price, stock: p.stock, unit: p.unit };
        };
        for (const i of useCart.getState().items) {
          const r = resolve(i);
          if (!r || r.stock <= 0) messages.push(`${i.name}${i.vlabel ? ` (${i.vlabel})` : ""} is no longer available and was removed from your cart.`);
          else if (i.qty > r.stock) messages.push(`Only ${r.stock} of ${i.name}${i.vlabel ? ` (${i.vlabel})` : ""} left. We updated your quantity.`);
        }
        useCartNotice.getState().set(messages);
        useCart.setState((s) => ({
          items: s.items.flatMap((i) => {
            const r = resolve(i);
            if (!r || r.stock <= 0) return [];
            return [{ ...i, slug: r.p.slug, name: r.p.name, price: r.price, unit: r.unit, ...(i.vid ? { vlabel: r.unit } : {}), image: r.p.image, emoji: r.p.emoji, stock: r.stock, rx: r.p.prescriptionRequired, qty: Math.min(i.qty, r.stock) }];
          }),
        }));
      } catch { /* offline: keep local cart */ }
      if (alive) setSynced(true);
    })();
    return () => { alive = false; };
  }, []);
  return synced;
}

/** Validates the coupon stored in the cart against the current subtotal. */
export function useCoupon(subtotal: number) {
  const code = useCart((s) => s.coupon); const setCoupon = useCart((s) => s.setCoupon);
  const [discount, setDiscount] = useState(0); const [title, setTitle] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!code) { setDiscount(0); setTitle(""); return; }
    let alive = true;
    const timer = setTimeout(() => { // wait until the quantity stops changing
      api<{ discount: number; title: string }>("/api/coupons/validate", { method: "POST", body: { code, subtotal } })
        .then((r) => { if (alive) { setDiscount(r.discount); setTitle(r.title); setError(""); } })
        .catch((e) => { if (alive) { setDiscount(0); setTitle(""); setError(e.message); } });
    }, 500);
    return () => { alive = false; clearTimeout(timer); };
  }, [code, subtotal]);
  const apply = async (c: string) => {
    setBusy(true); setError("");
    try { const r = await api<{ code: string }>("/api/coupons/validate", { method: "POST", body: { code: c, subtotal } }); setCoupon(r.code); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = () => { setCoupon(""); setError(""); };
  return { code, discount, title, error, busy, apply, remove };
}
