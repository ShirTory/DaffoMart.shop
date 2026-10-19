import type { DealBadgeSettings, DealKindId, Offer } from "./types";

export type DealKind = DealKindId;
/** What a badge needs to render (plain data, safe to pass from server to client components). */
export interface DealInfo { kind: DealKind; label: string; color?: string }

export const dealInfo = (kind: DealKind, cfg: DealBadgeSettings, labelOverride?: string): DealInfo => ({
  kind, label: labelOverride || cfg.kinds[kind].label, color: cfg.kinds[kind].color || undefined,
});

/** Badge for a discounted product, or null (badges off, discount below the minimum, or the matching badge is switched off). */
export function dealKindForProduct(p: { stock: number }, pct: number, cfg: DealBadgeSettings): DealKind | null {
  if (!cfg.enabled || pct < cfg.minDiscount) return null;
  const order: [DealKind, boolean][] = [
    ["mega", pct >= cfg.megaPct],
    ["limited", p.stock > 0 && p.stock <= cfg.limitedStock],
    ["hot", pct >= cfg.hotPct],
    ["value", pct >= cfg.valuePct],
    ["exclusive", true],
  ];
  for (const [k, ok] of order) if (ok && cfg.kinds[k].on) return k;
  return null;
}

/** Badge for an offer. Admin-written badge text wins when it names a kind; otherwise derive from the offer. */
export function dealKindForOffer(o: Pick<Offer, "badge" | "discountType" | "discountValue" | "minOrder" | "endsAt" | "code">, cfg: DealBadgeSettings, now = Date.now()): DealKind | null {
  if (!cfg.enabled || !cfg.onOffers) return null;
  const b = (o.badge || "").toLowerCase();
  const end = o.endsAt ? new Date(o.endsAt).getTime() : NaN;
  let k: DealKind;
  if (/mega|save|saving/.test(b)) k = "mega";
  else if (/limit|last|ending|flash/.test(b)) k = "limited";
  else if (/exclusive|vip|member/.test(b)) k = "exclusive";
  else if (/value|best/.test(b)) k = "value";
  else if (/hot|fire/.test(b)) k = "hot";
  else if (!Number.isNaN(end) && end - now < 3 * 86400000) k = "limited";
  else if (o.discountType === "percent" && o.discountValue >= cfg.hotPct) k = "mega";
  else if (o.code) k = "exclusive";
  else if (o.minOrder > 0) k = "value";
  else k = "hot";
  return cfg.kinds[k].on ? k : null;
}
