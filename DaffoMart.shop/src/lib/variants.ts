/**
 * Product variants (size / weight / colour) — pure helpers shared by the storefront, the admin panel and the server.
 * A variant is one purchasable combination with its own price and stock, e.g. { size: "M", color: "Red", price: 450, stock: 12 }.
 * When a product has variants, its own price / oldPrice / stock are DERIVED from them (see `rollup`) so listings, filters,
 * sorting and SEO keep working without knowing about variants.
 */
import type { Product, ProductVariant } from "./types";

export const VARIANT_ATTRS = ["size", "weight", "color"] as const;
export type VariantAttr = (typeof VARIANT_ATTRS)[number];
export const VARIANT_ATTR_LABEL: Record<VariantAttr, string> = { size: "Size", weight: "Weight", color: "Colour" };

type VariantLike = Pick<ProductVariant, "size" | "weight" | "color">;

/** "500 g / Red" — what the customer sees on the cart, invoice and order tracking. */
export const variantLabel = (v: VariantLike) => VARIANT_ATTRS.map((a) => (v[a] || "").trim()).filter(Boolean).join(" / ");

/** Case-insensitive identity of a combination; two variants of one product may never share it. */
export const variantKey = (v: VariantLike) => VARIANT_ATTRS.map((a) => (v[a] || "").trim().toLowerCase()).join("|");

export const hasVariants = (p: { variants?: ProductVariant[] } | null | undefined): boolean => Array.isArray(p?.variants) && p!.variants!.length > 0;
export const findVariant = (p: { variants?: ProductVariant[] } | null | undefined, id?: string) => (id && p?.variants ? p.variants.find((v) => v.id === id) : undefined);

/** Which attributes this product's variants actually use (drives which selector rows are shown). */
export const usedAttrs = (variants: VariantLike[]): VariantAttr[] => VARIANT_ATTRS.filter((a) => variants.some((v) => (v[a] || "").trim()));

/**
 * Product-level price / old price / stock derived from the variants: the price is the CHEAPEST variant ("From ৳X"),
 * independent of stock so a sell-out never silently changes it; stock is the total across variants.
 */
export function rollup(variants: ProductVariant[]): { price: number; oldPrice?: number; stock: number } {
  const stock = variants.reduce((n, v) => n + Math.max(0, Math.floor(Number(v.stock) || 0)), 0);
  const base = variants.reduce((a, b) => (b.price < a.price ? b : a));
  return { price: base.price, ...(base.oldPrice && base.oldPrice > base.price ? { oldPrice: base.oldPrice } : {}), stock };
}

/** True when `p` shows a price range ("From ৳X"). */
export const priceRange = (variants: ProductVariant[]) => {
  const prices = variants.map((v) => v.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

/**
 * Takes `delta` units from (negative) or gives back (positive) one variant's stock and re-derives the product's total stock.
 * Only `variants` and `stock` change (never the price), so the result is safe to write as a partial update.
 * Returns null when the variant does not exist.
 */
export function withVariantStock(p: { variants?: ProductVariant[] }, variantId: string, delta: number): Pick<Product, "variants" | "stock"> | null {
  if (!hasVariants(p) || !findVariant(p, variantId)) return null;
  const variants = (p.variants ?? []).map((v) => (v.id === variantId ? { ...v, stock: Math.max(0, (Number(v.stock) || 0) + delta) } : v));
  return { variants, stock: rollup(variants).stock };
}

/** Normalises what the admin typed: trims, drops empty rows, gives every row a stable id, derives product totals. */
export function normaliseVariants(input: Partial<ProductVariant>[] | undefined, newId: () => string): ProductVariant[] {
  const out: ProductVariant[] = [];
  for (const raw of input ?? []) {
    const v: Omit<ProductVariant, "id"> = {
      price: Number(raw.price) || 0, stock: Math.max(0, Math.floor(Number(raw.stock) || 0)),
      ...(raw.size?.trim() ? { size: raw.size.trim() } : {}), ...(raw.weight?.trim() ? { weight: raw.weight.trim() } : {}), ...(raw.color?.trim() ? { color: raw.color.trim() } : {}),
      ...(raw.colorHex ? { colorHex: raw.colorHex } : {}), ...(raw.oldPrice && raw.oldPrice > (Number(raw.price) || 0) ? { oldPrice: Number(raw.oldPrice) } : {}), ...(raw.sku?.trim() ? { sku: raw.sku.trim().toUpperCase() } : {}),
    };
    if (variantLabel(v)) out.push({ id: raw.id || newId(), ...v }); // a row with no size / weight / colour is dropped (and gets no id)
  }
  return out;
}

/** Message for the first duplicate combination, or "" when all are unique. */
export function duplicateVariant(variants: VariantLike[]): string {
  const seen = new Set<string>();
  for (const v of variants) { const k = variantKey(v); if (seen.has(k)) return `"${variantLabel(v)}" is added twice`; seen.add(k); }
  return "";
}

/**
 * Customer picked `value` for `attr`: choose the best matching variant, keeping the other chosen attributes when that
 * combination exists and is in stock, otherwise falling back to any in-stock variant with that value.
 */
export function pickVariant(variants: ProductVariant[], current: ProductVariant | undefined, attr: VariantAttr, value: string): ProductVariant | undefined {
  const match = variants.filter((v) => (v[attr] || "") === value);
  const keep = (v: ProductVariant) => VARIANT_ATTRS.every((a) => a === attr || !current || (v[a] || "") === (current[a] || ""));
  return match.find((v) => keep(v) && v.stock > 0) ?? match.find((v) => v.stock > 0) ?? match.find(keep) ?? match[0];
}

/** Whether choosing `value` for `attr` leads to anything in stock (used to grey a chip out). */
export const optionAvailable = (variants: ProductVariant[], attr: VariantAttr, value: string) => variants.some((v) => (v[attr] || "") === value && v.stock > 0);

/** Stock check for `qty` units of the chosen variant of `p`. Throws-free: returns an error message or "". */
export function variantStockProblem(p: { name: string; variants?: ProductVariant[] }, variantId: string | undefined, qty: number): string {
  if (!hasVariants(p)) return "";
  const v = findVariant(p, variantId);
  if (!variantId) return `Please choose an option for ${p.name}`;
  if (!v) return "An option in your cart is no longer available. Please review your cart.";
  const label = `${p.name} (${variantLabel(v)})`;
  if (v.stock <= 0) return `${label} is out of stock`;
  if (v.stock < qty) return `Only ${v.stock} of ${label} left in stock`;
  return "";
}
