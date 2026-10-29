"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "./types";
import { lineKey } from "./cartRules";

interface CartState {
  items: CartItem[]; coupon: string;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void; // key = lineKey(item)
  remove: (key: string) => void;
  setCoupon: (code: string) => void;
  clear: () => void;
}
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [], coupon: "",
      add: (item, qty = 1) => set((s) => {
        const key = lineKey(item); const ex = s.items.find((i) => lineKey(i) === key);
        const cap = (n: number) => (item.stock ? Math.min(n, item.stock) : n);
        return { items: ex ? s.items.map((i) => (lineKey(i) === key ? { ...i, ...item, qty: cap(i.qty + qty) } : i)) : [...s.items, { ...item, qty: cap(qty) }] };
      }),
      setQty: (key, qty) => set((s) => ({ items: s.items.map((i) => (lineKey(i) === key ? { ...i, qty: Math.max(1, i.stock ? Math.min(qty, i.stock) : qty) } : i)) })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => lineKey(i) !== key) })),
      setCoupon: (coupon) => set({ coupon }),
      clear: () => set({ items: [], coupon: "" }),
    }),
    { name: "daffomart-cart", version: 2 }
  )
);
