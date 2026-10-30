import { db } from "./db";
import { ApiError } from "./http";
import { defaultLayout, resolveLayout, validateLayout, type PageLayout } from "@/lib/productPage";

/**
 * Layout store. One document per scope in `product_layouts`: id "global" (the default for every product) or a product id (that product's override).
 * published = what customers see; draft = work in progress (never public); history = earlier published versions (newest last, max 10).
 */
export interface LayoutDoc {
  id: string; scope: "global" | "product"; published?: PageLayout; draft?: PageLayout;
  /** product scope only: when false the product follows the global layout (the override is kept for later) */
  enabled?: boolean; history: { layout: PageLayout; publishedAt: string; by: string }[]; version: number; updatedAt: string; updatedBy: string;
}
const MAX_HISTORY = 10;
export const isScopeId = (s: string) => s === "global" || /^[a-zA-Z0-9_-]{1,40}$/.test(s);

const mk = (scope: string, by: string, now: string): LayoutDoc => ({ id: scope, scope: scope === "global" ? "global" : "product", history: [], version: 0, updatedAt: now, updatedBy: by });
const check = (l: unknown): PageLayout => {
  const v = validateLayout(l);
  if (!v.ok) throw new ApiError(400, v.errors.join(" "));
  return v.layout;
};
async function edit(scope: string, by: string, fn: (d: LayoutDoc, now: string) => LayoutDoc | void) {
  if (!isScopeId(scope)) throw new ApiError(400, "Unknown layout scope");
  if (scope !== "global" && !(await db.get("products", scope))) throw new ApiError(404, "Product not found");
  const now = new Date().toISOString(); let err: ApiError | null = null;
  const out = await db.mutate<LayoutDoc>("product_layouts", scope, (cur) => {
    try { const base = cur ? structuredClone(cur) : mk(scope, by, now); const r = fn(base, now) ?? base; r.version = (cur?.version ?? 0) + 1; r.updatedAt = now; r.updatedBy = by; return r; }
    catch (e) { err = e as ApiError; return null; }
  });
  if (err) throw err;
  return out as LayoutDoc;
}

export const getLayoutDoc = (scope: string) => db.get<LayoutDoc>("product_layouts", scope);
/** Layout a customer sees for a product (published only) + where it came from. */
export function layoutFor(productId: string, docs: LayoutDoc[]) {
  const g = docs.find((d) => d.id === "global"); const o = docs.find((d) => d.id === productId && d.scope === "product");
  return resolveLayout(g?.published, o ? { enabled: o.enabled, published: o.published } : null);
}
/** The layout the editor starts from for a scope: draft if there is one, else what is live. */
export function editorLayout(scope: string, docs: LayoutDoc[]): PageLayout {
  const d = docs.find((x) => x.id === scope);
  if (d?.draft) { const v = validateLayout(d.draft); if (v.ok) return v.layout; }
  if (scope === "global") return resolveLayout(d?.published, null).layout;
  const g = docs.find((x) => x.id === "global");
  const o = d?.published ? validateLayout(d.published) : null;
  return o?.ok ? o.layout : resolveLayout(g?.published, null).layout;
}

export const saveDraft = (scope: string, layout: unknown, by: string) => { const l = check(layout); return edit(scope, by, (d) => { d.draft = l; }); };
export const discardDraft = (scope: string, by: string) => edit(scope, by, (d) => { delete d.draft; });
/** Publishes `layout` (or the saved draft). The version that was live moves to history so it can be restored. */
export const publish = (scope: string, layout: unknown, by: string) => edit(scope, by, (d, now) => {
  const l = check(layout ?? d.draft ?? (() => { throw new ApiError(400, "There is no draft to publish."); })());
  if (d.published) d.history = [...d.history, { layout: d.published, publishedAt: d.updatedAt, by: d.updatedBy }].slice(-MAX_HISTORY);
  d.published = l; delete d.draft; if (d.scope === "product") d.enabled = true; void now;
});
/** Brings back the previous published version (the current one is dropped). */
export const rollback = (scope: string, by: string) => edit(scope, by, (d) => {
  const prev = d.history[d.history.length - 1];
  if (!prev) throw new ApiError(409, "There is no earlier published version to restore.");
  d.history = d.history.slice(0, -1); d.published = prev.layout; delete d.draft;
});
/** Global: publish the shop default again. Product: stop using the override so the product follows the global layout. */
export const resetScope = (scope: string, by: string) => edit(scope, by, (d) => {
  if (d.scope === "global") { if (d.published) d.history = [...d.history, { layout: d.published, publishedAt: d.updatedAt, by: d.updatedBy }].slice(-MAX_HISTORY); d.published = defaultLayout(); }
  else { d.enabled = false; d.published = undefined; }
  delete d.draft;
});
export const setOverride = (productId: string, enabled: boolean, by: string) => edit(productId, by, (d) => {
  if (productId === "global") throw new ApiError(400, "The global layout is always on.");
  if (enabled && !d.published) throw new ApiError(409, "Publish a layout for this product first, then switch it on.");
  d.enabled = enabled;
});
