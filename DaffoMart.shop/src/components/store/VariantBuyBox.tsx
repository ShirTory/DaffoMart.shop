"use client";
import { useMemo, useState } from "react";
import AddToCart from "./AddToCart";
import { discountPct, taka } from "@/lib/format";
import type { Product } from "@/lib/types";
import { optionAvailable, pickVariant, usedAttrs, VARIANT_ATTR_LABEL, variantLabel, type VariantAttr } from "@/lib/variants";

/**
 * Price, size / weight / colour selectors, stock line and add-to-cart for a product that has variants.
 * Choosing an option swaps in that variant's own price and stock; the cart line records the chosen variant.
 */
export default function VariantBuyBox({ product, whatsapp }: { product: Product; whatsapp?: string }) {
  const variants = product.variants ?? [];
  const attrs = useMemo(() => usedAttrs(variants), [variants]);
  const [id, setId] = useState(() => (variants.find((v) => v.stock > 0) ?? variants[0])?.id);
  const v = variants.find((x) => x.id === id) ?? variants[0];
  if (!v) return null;
  const off = discountPct(v.price, v.oldPrice);
  const values = (a: VariantAttr) => [...new Set(variants.map((x) => (x[a] || "").trim()).filter(Boolean))];
  const swatch = (val: string) => variants.find((x) => x.color === val && x.colorHex)?.colorHex;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-4xl font-extrabold text-primary">{taka(v.price)}</span>
        {v.oldPrice && v.oldPrice > v.price ? <span className="text-lg text-gray-400 line-through">{taka(v.oldPrice)}</span> : null}
        {off > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-white">Save {off}%</span>}
      </div>
      {attrs.map((a) => (
        <div key={a} role="radiogroup" aria-label={VARIANT_ATTR_LABEL[a]}>
          <p className="label">{VARIANT_ATTR_LABEL[a]}: <span className="font-semibold text-gray-800">{v[a] || "—"}</span></p>
          <div className="flex flex-wrap gap-2">
            {values(a).map((val) => {
              const on = (v[a] || "") === val; const avail = optionAvailable(variants, a, val); const hex = a === "color" ? swatch(val) : undefined;
              return (
                <button key={val} type="button" role="radio" aria-checked={on} onClick={() => { const n = pickVariant(variants, v, a, val); if (n) setId(n.id); }}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition ${on ? "border-primary bg-primary-soft text-primary" : "border-gray-200 bg-white text-gray-700 hover:border-primary"} ${avail ? "" : "opacity-50"}`}>
                  {hex && <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: hex }} aria-hidden />}
                  <span className={avail ? "" : "line-through"}>{val}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className={`text-sm font-medium ${v.stock > 0 ? "text-emerald-600" : "text-red-600"}`} aria-live="polite">
        {v.stock <= 0 ? `${variantLabel(v)} is out of stock` : v.stock <= 10 ? `Only ${v.stock} left in stock` : "In stock"}
      </p>
      <div className="max-w-sm pt-1"><AddToCart key={v.id} product={product} variant={v} withQty showBuyNow whatsapp={whatsapp} /></div>
    </>
  );
}
