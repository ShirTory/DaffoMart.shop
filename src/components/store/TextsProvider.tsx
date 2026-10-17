"use client";
import { createContext, useContext, useMemo } from "react";
import { makeT, type TextFn } from "@/lib/texts";

export interface UiFlags { showBuyNow: boolean; showWishlist: boolean; showCardWhatsapp: boolean; showCardDelivery: boolean }
const DEFAULT_FLAGS: UiFlags = { showBuyNow: true, showWishlist: true, showCardWhatsapp: true, showCardDelivery: true };
const Ctx = createContext<{ texts?: Record<string, string>; flags: UiFlags }>({ flags: DEFAULT_FLAGS });

/** Gives client components the admin-edited wording and button visibility: const t = useT(); t("card.add") */
export function TextsProvider({ texts, flags, children }: { texts?: Record<string, string>; flags?: Partial<UiFlags>; children: React.ReactNode }) {
  const value = useMemo(() => ({ texts, flags: { ...DEFAULT_FLAGS, ...flags } }), [texts, flags?.showBuyNow, flags?.showWishlist, flags?.showCardWhatsapp, flags?.showCardDelivery]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useT(): TextFn { const { texts } = useContext(Ctx); return useMemo(() => makeT(texts), [texts]); }
export const useFlags = () => useContext(Ctx).flags;
