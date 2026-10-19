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
import type { Product } from "./types";

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
        for (const i of useCart.getState().items) {
          const p = map.get(i.id);
          if (!p || p.stock <= 0) messages.push(`${i.name} is no longer available and was removed from your cart.`);
          else if (i.qty > p.stock) messages.push(`Only ${p.stock} of ${i.name} left. We updated your quantity.`);
        }
        useCartNotice.getState().set(messages);
        useCart.setState((s) => ({
          items: s.items.filter((i) => map.has(i.id) && map.get(i.id)!.stock > 0).map((i) => {
            const p = map.get(i.id)!;
            return { ...i, slug: p.slug, name: p.name, price: p.price, unit: p.unit, image: p.image, emoji: p.emoji, stock: p.stock, rx: p.prescriptionRequired, qty: Math.min(i.qty, p.stock) };
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
