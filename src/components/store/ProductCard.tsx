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
import type { DealInfo } from "@/lib/deals";

const optimizable = (src: string) => src.startsWith("/api/uploads/") || src.startsWith("https://firebasestorage.googleapis.com/");
const RATIO = { square: "aspect-square", wide: "aspect-[4/3]", tall: "aspect-[4/5]" } as const;
const RADIUS = { md: "rounded-xl", lg: "rounded-2xl", xl: "rounded-3xl" } as const;
const LOOK = { flat: "border border-transparent", soft: "border border-gray-100 shadow-sm", outlined: "border border-gray-200" } as const;
const CARD_SIZES = "(min-width: 1280px) 16vw, (min-width: 768px) 20vw, 42vw";

export function ProductImage({ p, className = "", emojiSize = "text-5xl", priority = false }: { p: Pick<Product, "image" | "emoji" | "name">; className?: string; emojiSize?: string; priority?: boolean }) {
  if (!p.image) return <span className={`${emojiSize} select-none`}>{p.emoji}</span>;
  if (optimizable(p.image)) return <Image src={p.image} alt={p.name} fill sizes={CARD_SIZES} priority={priority} className={`object-contain p-2 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.image} alt={p.name} loading="lazy" decoding="async" className={`h-full w-full object-contain p-2 ${className}`} />;
}

export default function ProductCard({ p, whatsapp, deal, dealDelay = 0 }: { p: Product; whatsapp?: string; deal?: DealInfo | null; dealDelay?: number }) {
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
    <div className={`group relative flex h-full flex-col overflow-hidden bg-white lift ${RADIUS[flags.cardRadius] ?? RADIUS.xl} ${LOOK[flags.cardStyle] ?? LOOK.soft}`}>
      <div className="absolute left-0 top-0 z-10 flex flex-col items-start gap-0.5">
        {isBest && <span className="rounded-br-lg bg-primary px-2 py-0.5 text-[10px] font-bold text-white" style={lr.bestSellerColor ? { background: lr.bestSellerColor } : undefined}>{lr.bestSellerLabel || "Best Seller"}</span>}
        {isNew && !isBest && <span className="rounded-br-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white" style={lr.newColor ? { background: lr.newColor } : undefined}>{lr.newLabel || "New"}</span>}
        {isOffer && (
          <span className="m-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">{off}% {t("card.off")}</span>
        )}
        {out && lr.showOutOfStock && <span className="rounded-br-lg bg-gray-700 px-2 py-0.5 text-[10px] font-bold text-white">Out of Stock</span>}
      </div>
      <WishlistButton
        item={{ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image }}
        className="absolute right-2 top-2 z-10"
      />
      <Link href={`/products/${p.slug}`} className={`relative flex w-full items-center justify-center bg-white ${RATIO[flags.cardImageRatio] ?? RATIO.wide}`}>
        <ProductImage p={p} className="transition duration-300 motion-safe:group-hover:scale-105" />
        {deal && !out && <DealBadge deal={deal} delay={dealDelay} className="absolute bottom-1 left-1 z-[1]" />}
        {out && <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs font-bold text-gray-600">{t("card.out")}</span>}
      </Link>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-1.5">
        {flags.showCardDelivery && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <span className="truncate">{t("card.delivery")}</span>
          </p>
        )}
        <Link href={`/products/${p.slug}`} className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900 hover:text-primary">
          {p.name}
        </Link>
        {p.genericName && <p className="line-clamp-1 text-[11px] text-gray-500">{p.genericName}</p>}
        {(p.prescriptionRequired || (!out && p.stock <= 5)) && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {p.prescriptionRequired && <RxBadge />}
            {!out && p.stock <= 5 && <span className="font-semibold text-amber-600">Only {p.stock} left</span>}
          </p>
        )}
        <div className="mt-auto pt-2">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="price-now text-lg font-extrabold leading-tight">{taka(p.price)}</span>
            {p.oldPrice && p.oldPrice > p.price && <span className="text-xs text-gray-400 line-through">{taka(p.oldPrice)}</span>}
            {flags.cardShowUnit && p.unit && <span className="text-[11px] text-gray-500">/ {p.unit}</span>}
          </div>
          <div className="space-y-1.5 pt-2.5">
            {!out && flags.cardShowQtyStepper && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-lg border border-gray-200 bg-white" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => step(-1)} disabled={maxed || sel <= 1} aria-label="Decrease quantity" className="h-9 w-9 text-lg leading-none hover:bg-gray-50 disabled:opacity-30">−</button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{maxed ? 0 : sel}</span>
                  <button type="button" onClick={() => step(1)} disabled={maxed || sel >= left} aria-label="Increase quantity" className="h-9 w-9 text-lg leading-none hover:bg-gray-50 disabled:opacity-30">+</button>
                </div>
                {(msg || inCart > 0) && (
                  <p className={`min-w-0 flex-1 truncate text-[11px] ${msg ? "font-semibold text-primary" : "text-gray-500"}`} aria-live="polite">{msg || `${inCart} in cart`}</p>
                )}
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
            {((flags.showBuyNow) || (waHref && flags.showCardWhatsapp)) && (
              <div className="flex gap-1.5">
                {flags.showBuyNow && <button
                  type="button"
                  disabled={out || maxed}
                  onClick={onBuyNow}
                  className="h-9 flex-1 rounded-full border border-primary/60 bg-white text-xs font-semibold text-primary transition hover:bg-primary-soft disabled:opacity-40"
                >
                  {t("card.buyNow")}
                </button>}
                {waHref && flags.showCardWhatsapp && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full border border-[#25D366] bg-white text-center text-xs font-semibold text-[#128C4A] transition hover:bg-[#25D366]/10">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" /></svg>
                    {t("card.whatsapp")}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
