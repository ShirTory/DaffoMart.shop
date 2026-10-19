"use client";
import { createContext, useContext, useMemo } from "react";
import { makeT, type TextFn } from "@/lib/texts";
import type { LabelRules } from "@/lib/types";

export interface UiFlags {
  showBuyNow: boolean;
  showWishlist: boolean;
  showCardWhatsapp: boolean;
  showCardDelivery: boolean;
  labelRules: LabelRules;
}
const DEFAULT_LABELS: LabelRules = {
  showBestSeller: true, bestSellerMinSold: 5,
  showNewArrival: true, newArrivalDays: 14,
  showOffer: true, showOutOfStock: true,
};
const DEFAULT_FLAGS: UiFlags = {
  showBuyNow: true, showWishlist: true, showCardWhatsapp: true, showCardDelivery: true,
  labelRules: DEFAULT_LABELS,
};
const Ctx = createContext<{ texts?: Record<string, string>; flags: UiFlags }>({ flags: DEFAULT_FLAGS });

export function TextsProvider({ texts, flags, children }: { texts?: Record<string, string>; flags?: Partial<UiFlags> & { labelRules?: Partial<LabelRules> }; children: React.ReactNode }) {
  const value = useMemo(() => ({
    texts,
    flags: {
      ...DEFAULT_FLAGS,
      ...flags,
      labelRules: { ...DEFAULT_LABELS, ...(flags?.labelRules || {}) },
    },
  }), [texts, flags?.showBuyNow, flags?.showWishlist, flags?.showCardWhatsapp, flags?.showCardDelivery, flags?.labelRules]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useT(): TextFn { const { texts } = useContext(Ctx); return useMemo(() => makeT(texts), [texts]); }
export const useFlags = () => useContext(Ctx).flags;
