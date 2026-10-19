"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { discountPct, taka } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart } from "@/lib/store";
import { useMounted } from "@/lib/hooks";
import { clampQty, remainingStock } from "@/lib/cartRules";
import { RxBadge } from "./MedicineBadge";
import WishlistButton from "./WishlistButton";
import { useFlags, useT } from "./TextsProvider";
import DealBadge from "./DealBadge";
import type { DealKind } from "@/lib/deals";

const optimizable = (src: string) => src.startsWith("/api/uploads/") || src.startsWith("https://firebasestorage.googleapis.com/");
const CARD_SIZES = "(min-width: 1280px) 16vw, (min-width: 768px) 20vw, 42vw";

export function ProductImage({ p, className = "", emojiSize = "text-5xl", priority = false }: { p: Pick<Product, "image" | "emoji" | "name">; className?: string; emojiSize?: string; priority?: boolean }) {
  if (!p.image) return <span className={`${emojiSize} select-none`}>{p.emoji}</span>;
  if (optimizable(p.image)) return <Image src={p.image} alt={p.name} fill sizes={CARD_SIZES} priority={priority} className={`object-contain p-2 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.image} alt={p.name} loading="lazy" decoding="async" className={`h-full w-full object-contain p-2 ${className}`} />;
}

export default function ProductCard({ p, whatsapp, deal, dealDelay = 0 }: { p: Product; whatsapp?: string; deal?: DealKind; dealDelay?: number }) {
  const add = useCart((s) => s.add);
  const mounted = useMounted();
  const inCart = useCart((s) => (mounted ? s.items.find((i) => i.id === p.id)?.qty ?? 0 : 0)); // 0 until mounted: matches the server render
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const t = useT(); const flags = useFlags();
  const off = discountPct(p.price, p.oldPrice);
  const out = p.stock <= 0;
  const left = remainingStock(p.stock, inCart);      // units that can still be added
  const maxed = !out && left === 0;                  // everything in stock is already in the cart
  const sel = clampQty(qty, left);                   // 1 … left, or 0 when nothing can be added
  const lr = flags.labelRules;
  const isBest = lr.showBestSeller && (p.sold || 0) >= (lr.bestSellerMinSold || 5);
  const isNew = lr.showNewArrival && p.createdAt && (Date.now() - new Date(p.createdAt).getTime()) < (lr.newArrivalDays || 14) * 86400000;
  const isOffer = lr.showOffer && off > 0;
  const line = () => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image, stock: p.stock, rx: p.prescriptionRequired });
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 1800); };

  const step = (d: number) => {
    const next = qty + d;
    if (next > left) return flash(`Only ${p.stock} available`);
    setQty(Math.max(1, next));
  };
  const onAdd = () => {
    if (out || sel < 1) return;
    add(line(), sel);
    setQty(1); setDone(true); flash(`${sel} added to cart`);
    setTimeout(() => setDone(false), 1200);
  };
  const onBuyNow = () => { if (out || sel < 1) return; add(line(), sel); router.push("/checkout"); };

  const wa = (whatsapp || "").replace(/\D/g, "");
  const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi, I want: ${p.name}${sel > 1 ? ` × ${sel}` : ""}`)}` : "";

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lift">
      <div className="absolute left-0 top-0 z-10 flex flex-col items-start gap-0.5">
        {isBest && <span className="rounded-br-lg bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Best Seller</span>}
        {isNew && !isBest && <span className="rounded-br-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">New</span>}
        {isOffer && (
          <span className="m-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">{off}% {t("card.off")}</span>
        )}
        {out && lr.showOutOfStock && <span className="rounded-br-lg bg-gray-700 px-2 py-0.5 text-[10px] font-bold text-white">Out of Stock</span>}
      </div>
      <WishlistButton
        item={{ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image }}
        className="absolute right-2 top-2 z-10"
      />
      <Link href={`/products/${p.slug}`} className="relative mx-auto flex aspect-square w-full max-w-[180px] items-center justify-center bg-white">
        <ProductImage p={p} className="transition duration-300 motion-safe:group-hover:scale-105" />
        {deal && !out && <DealBadge kind={deal} delay={dealDelay} className="absolute bottom-1 left-1 z-[1]" />}
        {out && <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs font-bold text-gray-600">{t("card.out")}</span>}
      </Link>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-1">
        {flags.showCardDelivery && <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("card.delivery")}</p>}
        <Link href={`/products/${p.slug}`} className="mt-0.5 line-clamp-2 min-h-[2.4rem] text-sm font-medium leading-snug text-gray-800 hover:text-primary">
          {p.name}
        </Link>
        {p.genericName && <p className="line-clamp-1 text-[11px] text-gray-400">{p.genericName}</p>}
        <p className="mt-1 flex min-h-[1rem] flex-wrap items-center gap-1 text-[11px] text-gray-500">
          {p.prescriptionRequired && <RxBadge />}
          <span>{p.unit}</span>
          {!out && p.stock <= 5 && <span className="font-semibold text-amber-600">· Only {p.stock} left</span>}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {p.oldPrice && p.oldPrice > p.price && (
            <span className="text-xs text-gray-400 line-through">{taka(p.oldPrice)}</span>
          )}
          <span className="text-base font-extrabold text-accent-dark">{taka(p.price)}</span>
          <span className="text-[10px] text-gray-400">Per {p.unit}</span>
        </div>
        <div className="mt-auto space-y-1.5 pt-3">
          {!out && (
            <div className="flex items-center gap-2">
              <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-lg border bg-white" role="group" aria-label="Quantity">
                <button type="button" onClick={() => step(-1)} disabled={maxed || sel <= 1} aria-label="Decrease quantity" className="h-9 w-9 text-lg leading-none hover:bg-gray-50 disabled:opacity-30">−</button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{maxed ? 0 : sel}</span>
                <button type="button" onClick={() => step(1)} disabled={maxed || sel >= left} aria-label="Increase quantity" className="h-9 w-9 text-lg leading-none hover:bg-gray-50 disabled:opacity-30">+</button>
              </div>
              <p className={`min-w-0 flex-1 truncate text-[11px] ${msg ? "font-semibold text-primary" : "text-gray-400"}`} aria-live="polite">
                {msg || (inCart > 0 ? `${inCart} in cart` : "")}
              </p>
            </div>
          )}
          <button
            type="button"
            disabled={out || maxed}
            onClick={onAdd}
            className={`h-10 w-full ${out || maxed ? "btn cursor-not-allowed bg-gray-100 text-gray-400" : done ? "btn bg-emerald-600 text-white" : "btn-primary"}`}
          >
            {out ? t("card.out") : maxed ? "Max in cart" : done ? t("card.added") : t("card.add")}
          </button>
          <div className="flex gap-1.5">
            {flags.showBuyNow && <button
              type="button"
              disabled={out || maxed}
              onClick={onBuyNow}
              className="h-9 flex-1 rounded-full border border-primary text-xs font-semibold text-primary hover:bg-primary-soft disabled:opacity-40"
            >
              {t("card.buyNow")}
            </button>}
            {waHref && flags.showCardWhatsapp && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex h-9 flex-1 items-center justify-center rounded-full bg-[#25D366] text-center text-xs font-semibold text-white hover:bg-[#1da851]">
                {t("card.whatsapp")}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
