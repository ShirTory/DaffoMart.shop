"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store";
import type { Product } from "@/lib/types";
import { useFlags, useT } from "./TextsProvider";

export default function AddToCart({
  product,
  withQty = false,
  showBuyNow = false,
  whatsapp,
}: {
  product: Product;
  withQty?: boolean;
  showBuyNow?: boolean;
  /** full international digits e.g. 8801XXXXXXXXX — if set, shows WhatsApp button */
  whatsapp?: string;
}) {
  const add = useCart((s) => s.add); const t = useT(); const flags = useFlags();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const out = product.stock <= 0;

  const line = () => ({
    id: product.id, slug: product.slug, name: product.name, price: product.price,
    unit: product.unit, emoji: product.emoji, image: product.image, stock: product.stock, rx: product.prescriptionRequired,
  });

  const onAdd = () => {
    add(line(), qty);
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };

  const onBuyNow = () => {
    add(line(), qty);
    router.push("/checkout");
  };

  const wa = (whatsapp || "").replace(/\D/g, "");
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi, I want to order: ${product.name} (${product.unit}) × ${qty}`)}`
    : "";

  return (
    <div className="flex flex-col gap-2">
      {(withQty || showBuyNow) && !out && (
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center rounded-lg border bg-white">
            <button type="button" className="px-2.5 py-1.5 text-lg hover:bg-gray-50" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
            <span className="w-7 text-center text-sm font-semibold">{qty}</span>
            <button type="button" className="px-2.5 py-1.5 text-lg hover:bg-gray-50" onClick={() => setQty((q) => Math.min(product.stock, q + 1))} aria-label="Increase">+</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${done ? "btn bg-emerald-600 text-white" : "btn-accent"} min-w-0 flex-1 text-sm`} disabled={out} onClick={onAdd}>
          {out ? t("card.out") : done ? t("card.added") : t("card.add").replace(/^\+\s*/, "")}
        </button>
        {showBuyNow && flags.showBuyNow && !out && (
          <button type="button" className="btn-primary min-w-0 flex-1 text-sm" onClick={onBuyNow}>{t("card.buyNow")}</button>
        )}
        {waHref && flags.showCardWhatsapp && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-white hover:bg-[#1da851] min-w-0 flex-1 text-sm text-center">
            {t("card.whatsapp")}
          </a>
        )}
      </div>
    </div>
  );
}
