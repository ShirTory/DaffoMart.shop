/**
 * Product page layout: which sections appear, in what order, with which headings.
 * Pure and client-safe: used by the storefront, the visual builder and the server validators.
 */
export type SectionId = "overview" | "brand" | "specs" | "video" | "gallery" | "reviews" | "sameCategory" | "recommended";
export interface SectionConfig { id: SectionId; enabled: boolean; title: string; subtitle: string; display?: "grid" | "carousel"; limit?: number }
export interface PageLayout { sections: SectionConfig[] }

export const SECTION_META: Record<SectionId, { label: string; /** can be removed from the layout (otherwise it can only be hidden) */ optional: boolean; reco: boolean; hint: string }> = {
  overview: { label: "Product Overview & Description", optional: false, reco: false, hint: "Gallery, price, stock, quantity, Add to cart / Buy now, wishlist, rating and the sectioned description." },
  brand: { label: "Manufacturer & Brand Information", optional: true, reco: false, hint: "Brand, manufacturer, country of origin and the manufacturer note." },
  specs: { label: "Product Specifications", optional: false, reco: false, hint: "Table of the specifications entered for each product (empty rows are never shown)." },
  video: { label: "Promotional Video", optional: false, reco: false, hint: "Uploaded or linked video. Hidden automatically when a product has none." },
  gallery: { label: "Additional Product Images", optional: false, reco: false, hint: "Extra photos with thumbnails and a zoom lightbox." },
  reviews: { label: "Customer Reviews & Ratings", optional: false, reco: false, hint: "Average, rating split, written reviews, review form." },
  sameCategory: { label: "Same Category Products", optional: false, reco: true, hint: "Products chosen by you for this product (falls back to the same category)." },
  recommended: { label: "Other Category / Recommended Products", optional: false, reco: true, hint: "Products from other categories chosen by you." },
};
export const SECTION_IDS = Object.keys(SECTION_META) as SectionId[];

const D = (id: SectionId, title: string, subtitle = "", extra: Partial<SectionConfig> = {}): SectionConfig => ({ id, enabled: true, title, subtitle, ...extra });
/** The default order required by the shop: 01 overview, 02 specs, 03 video, 04 images, 05 reviews, 06 same category, 07 recommended. (Brand is an optional extra.) */
export const DEFAULT_SECTIONS: SectionConfig[] = [
  D("overview", "Product Overview & Description"),
  D("specs", "Product Specifications"),
  D("video", "Promotional Video", "See it in action"),
  D("gallery", "More Product Images", "Different angles and close-ups"),
  D("reviews", "Customer Reviews & Ratings", "What customers say"),
  D("sameCategory", "More from this category", "", { display: "grid", limit: 5 }),
  D("recommended", "You may also like", "", { display: "grid", limit: 5 }),
];
export const defaultLayout = (): PageLayout => ({ sections: DEFAULT_SECTIONS.map((s) => ({ ...s })) });
/** Config for a section that is added from the "Add section" list. */
export const newSection = (id: SectionId): SectionConfig => {
  const base = DEFAULT_SECTIONS.find((s) => s.id === id);
  return base ? { ...base } : { id, enabled: true, title: SECTION_META[id].label, subtitle: "" };
};

export type LayoutCheck = { ok: true; layout: PageLayout } | { ok: false; errors: string[] };
/** Strict validation + normalisation. Used before every save and before every publish; unknown / duplicated / malformed sections are errors. */
export function validateLayout(input: unknown): LayoutCheck {
  const errors: string[] = [];
  const arr = (input as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(arr)) return { ok: false, errors: ["The layout must contain a list of sections."] };
  if (arr.length < 1 || arr.length > SECTION_IDS.length) return { ok: false, errors: [`A layout has 1 to ${SECTION_IDS.length} sections.`] };
  const seen = new Set<string>(); const out: SectionConfig[] = [];
  arr.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>; const id = r.id as SectionId;
    if (!SECTION_IDS.includes(id)) { errors.push(`Section ${i + 1}: unknown section "${String(r.id)}".`); return; }
    if (seen.has(id)) { errors.push(`"${SECTION_META[id].label}" is listed twice.`); return; }
    seen.add(id);
    const title = typeof r.title === "string" ? r.title.trim() : "", subtitle = typeof r.subtitle === "string" ? r.subtitle.trim() : "";
    if (!title) errors.push(`"${SECTION_META[id].label}" needs a title.`);
    if (title.length > 80) errors.push(`The title of "${SECTION_META[id].label}" is longer than 80 characters.`);
    if (subtitle.length > 160) errors.push(`The subtitle of "${SECTION_META[id].label}" is longer than 160 characters.`);
    if (typeof r.enabled !== "boolean") errors.push(`"${SECTION_META[id].label}": enabled must be on or off.`);
    const s: SectionConfig = { id, enabled: r.enabled === true, title, subtitle };
    if (SECTION_META[id].reco) {
      const display = r.display === "carousel" ? "carousel" : r.display === "grid" || r.display === undefined ? "grid" : null;
      if (!display) errors.push(`"${SECTION_META[id].label}": display must be grid or carousel.`); else s.display = display;
      const limit = r.limit === undefined ? 5 : Number(r.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 24) errors.push(`"${SECTION_META[id].label}": show 1 to 24 products.`); else s.limit = limit;
    }
    out.push(s);
  });
  for (const id of SECTION_IDS) if (!SECTION_META[id].optional && !seen.has(id)) errors.push(`"${SECTION_META[id].label}" cannot be removed (hide it instead).`);
  if (!errors.length && !out.find((s) => s.id === "overview")?.enabled) errors.push("Product Overview & Description must stay visible: it holds the price and the Add to cart button.");
  return errors.length ? { ok: false, errors } : { ok: true, layout: { sections: out } };
}
/** Always returns a usable layout: the candidate if valid, else the fallback (the shop default). Never throws. */
export function safeLayout(candidate: unknown, fallback: PageLayout = defaultLayout()): PageLayout {
  const v = validateLayout(candidate); return v.ok ? v.layout : fallback;
}
/** What a product page renders: the product's own published layout when it has an active override, else the published global layout, else the default. */
export function resolveLayout(globalPublished: unknown, productOverride: { enabled?: boolean; published?: unknown } | null | undefined): { layout: PageLayout; source: "product" | "global" | "default" } {
  const g = validateLayout(globalPublished);
  const fallback = g.ok ? g.layout : defaultLayout();
  if (productOverride?.enabled) { const o = validateLayout(productOverride.published); if (o.ok) return { layout: o.layout, source: "product" }; }
  return { layout: fallback, source: g.ok ? "global" : "default" };
}

/* ------------------------------------------------------------ product content helpers */
/** Only specs that have both a label and a value. */
export const visibleSpecs = <T extends { label?: string; value?: string }>(rows?: T[]) => (rows ?? []).filter((r) => (r.label ?? "").trim() && (r.value ?? "").trim());
export const visibleDesc = <T extends { title?: string; body?: string }>(rows?: T[]) => (rows ?? []).filter((r) => (r.body ?? "").trim());

/** Admin-picked ids -> products, keeping the admin's order, dropping unknown / hidden / duplicate ids and anything in `exclude`. */
export function pickProducts<T extends { id: string }>(ids: string[] | undefined, byId: Map<string, T>, exclude: Set<string>, limit: number): T[] {
  const out: T[] = []; const seen = new Set(exclude);
  for (const id of ids ?? []) { const p = byId.get(id); if (!p || seen.has(id)) continue; seen.add(id); out.push(p); if (out.length >= limit) break; }
  return out;
}

/* ------------------------------------------------------------ video links */
export type VideoSource = { type: "youtube"; id: string; embed: string; thumb: string } | { type: "vimeo"; id: string; embed: string } | { type: "file"; url: string };
/** Understands YouTube, Vimeo and direct https .mp4 / .webm links. null = not supported (so nothing else can be embedded). */
export function parseVideoUrl(raw: string): VideoSource | null {
  let u: URL; try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(embed|shorts|live)\/([\w-]{11})/.exec(u.pathname)?.[2];
    return id && /^[\w-]{11}$/.test(id) ? { type: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } : null;
  }
  if (host === "youtu.be") { const id = u.pathname.slice(1); return /^[\w-]{11}$/.test(id) ? { type: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } : null; }
  if (host === "vimeo.com" || host === "player.vimeo.com") { const id = /(\d{6,12})/.exec(u.pathname)?.[1]; return id ? { type: "vimeo", id, embed: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1` } : null; }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { type: "file", url: u.toString() };
  return null;
}
/** A video the product page may show: enabled, has a playable source. Own uploads are paths under /api/uploads/ or Firebase Storage URLs. */
export function playableVideo(v?: { kind?: string; url?: string; enabled?: boolean }): VideoSource | null {
  if (!v || v.enabled === false || !v.url) return null;
  if (v.kind === "upload") return /^\/api\/uploads\/video\/[a-z0-9-]+\.(mp4|webm)$/.test(v.url) || /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//.test(v.url) ? { type: "file", url: v.url } : null;
  return parseVideoUrl(v.url);
}
/** 4.5 -> "4.5"; null when there are no reviews (never invent a rating). */
export const ratingText = (avg?: number, count?: number) => (count && count > 0 && avg && avg > 0 ? (Math.round(avg * 10) / 10).toFixed(1) : null);
