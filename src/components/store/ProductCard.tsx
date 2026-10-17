"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { discountPct, taka } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart } from "@/lib/store";
import { RxBadge } from "./MedicineBadge";
import WishlistButton from "./WishlistButton";
import { useFlags, useT } from "./TextsProvider";

const optimizable = (src: string) => src.startsWith("/api/uploads/") || src.startsWith("https://firebasestorage.googleapis.com/");
const CARD_SIZES = "(min-width: 1280px) 16vw, (min-width: 768px) 20vw, 42vw";

export function ProductImage({ p, className = "", emojiSize = "text-5xl", priority = false }: { p: Pick<Product, "image" | "emoji" | "name">; className?: string; emojiSize?: string; priority?: boolean }) {
  if (!p.image) return <span className={`${emojiSize} select-none`}>{p.emoji}</span>;
  if (optimizable(p.image)) return <Image src={p.image} alt={p.name} fill sizes={CARD_SIZES} priority={priority} className={`object-contain p-2 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.image} alt={p.name} loading="lazy" decoding="async" className={`h-full w-full object-contain p-2 ${className}`} />;
}

export default function ProductCard({ p, whatsapp }: { p: Product; whatsapp?: string }) {
  const add = useCart((s) => s.add);
  const router = useRouter();
  const [done, setDone] = useState(false);
  const t = useT(); const flags = useFlags();
  const off = discountPct(p.price, p.oldPrice);
  const out = p.stock <= 0;

  const onAdd = () => {
    if (out) return;
    add({ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image, stock: p.stock, rx: p.prescriptionRequired }, 1);
    setDone(true);
    setTimeout(() => setDone(false), 1200);
  };

  const wa = (whatsapp || "").replace(/\D/g, "");
  const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi, I want: ${p.name}`)}` : "";

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      {off > 0 && (
        <span className="absolute left-0 top-0 z-10 rounded-br-lg bg-accent px-2 py-0.5 text-[11px] font-bold text-white">৳{Math.round((p.oldPrice! - p.price))} {t("card.off")}</span>
      )}
      <WishlistButton
        item={{ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image }}
        className="absolute right-2 top-2 z-10"
      />
      <Link href={`/products/${p.slug}`} className="relative mx-auto flex aspect-square w-full max-w-[180px] items-center justify-center bg-white">
        <ProductImage p={p} className="transition duration-300 group-hover:scale-105" />
        {out && <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs font-bold text-gray-600">{t("card.out")}</span>}
      </Link>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-1">
        {flags.showCardDelivery && <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("card.delivery")}</p>}
        <Link href={`/products/${p.slug}`} className="mt-0.5 line-clamp-2 min-h-[2.4rem] text-sm font-medium leading-snug text-gray-800 hover:text-primary">
          {p.name}
        </Link>
        {p.genericName && <p className="line-clamp-1 text-[11px] text-gray-400">{p.genericName}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
          {p.prescriptionRequired && <RxBadge />}
          <span>{p.unit}</span>
          {!out && p.stock <= 5 && <span className="font-semibold text-amber-600">· Only {p.stock} left</span>}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {p.oldPrice && p.oldPrice > p.price && (
            <span className="text-xs text-gray-400 line-through">{taka(p.oldPrice)}</span>
          )}
          <span className="text-base font-bold text-primary">{taka(p.price)}</span>
          <span className="text-[10px] text-gray-400">Per {p.unit}</span>
        </div>
        <div className="mt-auto space-y-1.5 pt-3">
          <button
            type="button"
            disabled={out}
            onClick={onAdd}
            className={`w-full ${out ? "btn cursor-not-allowed bg-gray-100 text-gray-400" : done ? "btn bg-emerald-600 text-white" : "btn-primary"}`}
          >
            {out ? t("card.out") : done ? t("card.added") : t("card.add")}
          </button>
          <div className="flex gap-1.5">
            {flags.showBuyNow && <button
              type="button"
              disabled={out}
              onClick={() => { if (out) return; add({ id: p.id, slug: p.slug, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji, image: p.image, stock: p.stock, rx: p.prescriptionRequired }, 1); router.push("/checkout"); }}
              className="flex-1 rounded-full border border-primary py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft disabled:opacity-40"
            >
              {t("card.buyNow")}
            </button>}
            {waHref && flags.showCardWhatsapp && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-full bg-[#25D366] py-1.5 text-center text-xs font-semibold text-white hover:bg-[#1da851]">
                {t("card.whatsapp")}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
