/** Offer-window helpers for discounted products. Pure (no I/O) so the storefront, the carousel and the tests share one rule. */
import type { Product } from "./types";

export type OfferWindow = "none" | "scheduled" | "live" | "expired";
const DAY = 86_400_000;
const at0 = (d: string) => Date.parse(d + "T00:00:00+06:00"); // dates are Bangladesh calendar days

/** Is the product's own offer window open? Products without dates are "live" whenever they carry a discount. */
export function offerWindow(p: Pick<Product, "offerStartsAt" | "offerEndsAt">, at = Date.now()): OfferWindow {
  if (p.offerStartsAt && at < at0(p.offerStartsAt)) return "scheduled";
  if (p.offerEndsAt && at >= at0(p.offerEndsAt) + DAY) return "expired"; // end date is inclusive
  return p.offerStartsAt || p.offerEndsAt ? "live" : "none";
}
/** Active offer product = published, really discounted (old price above price) and inside its offer window. Stock is shown, not filtered. */
export function isOfferProduct(p: Product, at = Date.now()) {
  return p.active && !!p.oldPrice && p.oldPrice > p.price && p.price >= 0 && offerWindow(p, at) !== "expired" && offerWindow(p, at) !== "scheduled";
}
export function offerProducts(all: Product[], limit = 24, at = Date.now()) {
  return all.filter((p) => isOfferProduct(p, at)).sort((a, b) => ((b.oldPrice! - b.price) / b.oldPrice!) - ((a.oldPrice! - a.price) / a.oldPrice!)).slice(0, limit);
}
/** Human text for the card, e.g. "Ends in 3 days", "Ends today", "Until 30 Nov". */
export function offerEndsText(p: Pick<Product, "offerEndsAt">, at = Date.now()): string {
  if (!p.offerEndsAt) return "";
  const left = Math.ceil((at0(p.offerEndsAt) + DAY - at) / DAY);
  if (left <= 1) return "Ends today"; if (left <= 7) return `Ends in ${left} days`;
  return "Until " + new Date(at0(p.offerEndsAt)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
}
