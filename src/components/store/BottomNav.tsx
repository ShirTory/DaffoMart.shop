"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/store";
import { useWishlist } from "@/lib/wishlist";
import { useEffect, useState } from "react";
import { useFlags, useT } from "./TextsProvider";

const tabs = [
  { href: "/", key: "nav.home", icon: "M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" },
  { href: "/wishlist", key: "nav.wishlist", icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" },
  { href: "/cart", key: "nav.cart", icon: "M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6M10 21h.01M18 21h.01" },
  { href: "/orders", key: "nav.orders", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
];

export default function BottomNav() {
  const path = usePathname(); const t = useT(); const flags = useFlags();
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const wish = useWishlist((s) => s.items.length);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Mobile">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.filter((x) => flags.showWishlist || x.href !== "/wishlist").map((x) => {
          const active = x.href === "/" ? path === "/" : path.startsWith(x.href);
          const badge = x.href === "/cart" ? count : x.href === "/wishlist" ? wish : 0;
          return (
            <Link key={x.href} href={x.href} className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? "text-primary" : "text-gray-500"}`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={x.icon} /></svg>
              {t(x.key)}
              {mounted && badge > 0 && <span className="absolute right-[18%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{badge}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
