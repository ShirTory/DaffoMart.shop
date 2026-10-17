/** Site-wide constants used by layout, robots and sitemap. Set NEXT_PUBLIC_SITE_URL to your real https address. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
export const SITE_NAME = "DaffoMart";
export const DEFAULT_TAGLINE = "Everyday Essentials, Delivered with Care.";
export const DEFAULT_DESC =
  "DaffoMart — everyday essentials delivered with care. Fresh groceries, medicines, and household needs. Fast delivery. Cash on delivery available.";
export const DEFAULT_OG = "/og-default.png";
