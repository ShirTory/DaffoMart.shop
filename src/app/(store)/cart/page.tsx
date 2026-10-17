"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/store";
import { useCartSync, useCoupon } from "@/lib/hooks";
import { taka } from "@/lib/format";
import { useT } from "@/components/store/TextsProvider";

export default function CartPage() {
  const { items, setQty, remove } = useCart(); const t = useT();
  const [mounted, setMounted] = useState(false); const [input, setInput] = useState("");
  useEffect(() => setMounted(true), []);
  useCartSync();
  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  const c = useCoupon(subtotal);
  if (!mounted) return <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />;

  if (!items.length) return (
    <div className="rounded-2xl border bg-white p-12 text-center shadow-card"><p className="text-5xl">🛒</p><h1 className="mt-3 text-xl font-bold">Your cart is empty</h1><p className="mt-1 text-sm text-gray-500">Looks like you haven&apos;t added anything yet.</p><Link href="/products" className="btn-primary mt-5">Start shopping</Link></div>
  );
  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold tracking-tight">{t("cart.title")} <span className="text-base font-normal text-gray-500">({items.length} item{items.length > 1 ? "s" : ""})</span></h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-card sm:gap-4">
              <Link href={`/products/${i.slug}`} className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-4xl">{i.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt={i.name} className="h-full w-full object-cover" /> : i.emoji}</Link>
              <div className="min-w-0 flex-1"><Link href={`/products/${i.slug}`} className="line-clamp-2 font-semibold hover:text-primary">{i.name}</Link><p className="text-xs text-gray-500">{i.unit} · {taka(i.price)}</p>
                <div className="mt-2 flex items-center gap-3"><div className="flex items-center rounded-lg border"><button className="px-2.5 py-1 hover:bg-gray-50" onClick={() => setQty(i.id, i.qty - 1)} aria-label="Decrease">−</button><span className="w-7 text-center text-sm font-semibold">{i.qty}</span><button className="px-2.5 py-1 hover:bg-gray-50" onClick={() => setQty(i.id, i.qty + 1)} aria-label="Increase">+</button></div>
                  <button onClick={() => remove(i.id)} className="text-xs font-medium text-red-600 hover:underline">Remove</button></div></div>
              <p className="font-bold">{taka(i.price * i.qty)}</p>
            </div>))}
        </div>
        <aside className="h-fit space-y-4 rounded-2xl border bg-white p-5 shadow-card lg:sticky lg:top-40">
          <h2 className="font-bold">Order summary</h2>
          {c.code ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><span>🎟️ <b>{c.code}</b> applied</span><button onClick={c.remove} className="text-xs font-semibold underline">Remove</button></div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) c.apply(input.trim()); }} className="flex gap-2"><input className="input uppercase" placeholder="Coupon code" value={input} onChange={(e) => setInput(e.target.value)} /><button className="btn-outline" disabled={c.busy}>Apply</button></form>)}
          {c.error && <p className="text-xs text-red-600">{c.error}</p>}
          <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{taka(subtotal)}</span></div>
            {c.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−{taka(c.discount)}</span></div>}
            <p className="text-xs text-gray-500">Delivery charge is calculated at checkout.</p></div>
          <Link href="/checkout" className="btn-accent w-full py-3">{t("cart.checkout")}</Link>
          <Link href="/products" className="block text-center text-sm text-gray-500 hover:text-primary">← {t("checkout.continue")}</Link>
        </aside>
      </div>
    </div>
  );
}
