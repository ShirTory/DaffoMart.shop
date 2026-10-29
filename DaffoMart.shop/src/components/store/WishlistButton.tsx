"use client";
import { useEffect, useState } from "react";
import { useWishlist, type WishlistItem } from "@/lib/wishlist";
import { useFlags } from "./TextsProvider";

export default function WishlistButton({ item, className = "" }: { item: WishlistItem; className?: string }) {
  const { add, remove, has } = useWishlist();
  const [on, setOn] = useState(false); const flags = useFlags();
  useEffect(() => { setOn(has(item.id)); }, [item.id, has]);
  if (!flags.showWishlist) return null;
  return (
    <button
      type="button"
      aria-label={on ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={on}
      className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white/95 text-lg shadow-sm transition hover:scale-105 ${on ? "border-red-200 text-red-500" : "border-gray-200 text-gray-400 hover:text-red-500"} ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (on) remove(item.id); else add(item);
        setOn(!on);
      }}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}
