import type { Offer } from "./types";

export type DealKind = "hot" | "value" | "mega" | "limited" | "exclusive";

/** Pick a deal badge for a discounted product from data we already have (discount %, stock). */
export function dealKindForProduct(p: { stock: number }, pct: number): DealKind {
  if (pct >= 40) return "mega";
  if (p.stock > 0 && p.stock <= 5) return "limited";
  if (pct >= 30) return "hot";
  if (pct >= 20) return "value";
  return "exclusive";
}

/** Pick a deal badge for an offer. Admin-written badge text wins when it names a kind; otherwise derive from the offer. */
export function dealKindForOffer(o: Pick<Offer, "badge" | "discountType" | "discountValue" | "minOrder" | "endsAt" | "code">, now = Date.now()): DealKind {
  const b = (o.badge || "").toLowerCase();
  if (/mega|save|saving/.test(b)) return "mega";
  if (/limit|last|ending|flash/.test(b)) return "limited";
  if (/exclusive|vip|member/.test(b)) return "exclusive";
  if (/value|best/.test(b)) return "value";
  if (/hot|fire/.test(b)) return "hot";
  const end = o.endsAt ? new Date(o.endsAt).getTime() : NaN;
  if (!Number.isNaN(end) && end - now < 3 * 86400000) return "limited";
  if (o.discountType === "percent" && o.discountValue >= 30) return "mega";
  if (o.code) return "exclusive";
  if (o.minOrder > 0) return "value";
  return "hot";
}
