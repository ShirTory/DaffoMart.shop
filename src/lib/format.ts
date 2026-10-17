/** "+880 1712-345678" / "8801712345678" / "01712 345678" -> "01712345678" (leaves anything else untouched) */
export const normPhone = (v: string) => {
  const s = (v ?? "").replace(/[\s-]/g, "").replace(/^\+?88(?=01)/, "");
  return s;
};
export const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-US")}`;
export const discountPct = (price: number, oldPrice?: number) => (oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0);
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
