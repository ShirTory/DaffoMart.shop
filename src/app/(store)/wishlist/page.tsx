"use client";
import Link from "next/link";
import { useWishlist } from "@/lib/wishlist";
import { useCart } from "@/lib/store";
import { taka } from "@/lib/format";
import { ProductImage } from "@/components/store/ProductCard";

export default function WishlistPage() {
  const { items, remove } = useWishlist();
  const add = useCart((s) => s.add);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-5xl">♡</p>
        <h1 className="mt-4 text-2xl font-bold">Your wishlist is empty</h1>
        <p className="mt-2 text-gray-500">Save products you like for later.</p>
        <Link href="/products" className="btn-primary mt-6 inline-flex">Browse products</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Wishlist ({items.length})</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="flex gap-3 rounded-2xl border bg-white p-3 shadow-card">
            <Link href={`/products/${p.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
              <ProductImage p={p} emojiSize="text-3xl" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/products/${p.slug}`} className="line-clamp-2 text-sm font-semibold">{p.name}</Link>
              <p className="mt-0.5 text-sm font-bold text-primary">{taka(p.price)} <span className="text-xs font-normal text-gray-400">/ {p.unit}</span></p>
              <div className="mt-auto flex gap-2 pt-2">
                <button
                  className="btn-primary btn-sm flex-1"
                  onClick={() => add({ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image })}
                >
                  Add to cart
                </button>
                <button className="btn-ghost btn-sm text-red-600" onClick={() => remove(p.id)} aria-label="Remove from wishlist">
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
