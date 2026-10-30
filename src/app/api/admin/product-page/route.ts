import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { discardDraft, editorLayout, getLayoutDoc, isScopeId, publish, resetScope, rollback, saveDraft, setOverride, type LayoutDoc } from "@/server/productPage";
import { defaultLayout, resolveLayout } from "@/lib/productPage";
import { logAudit } from "@/server/audit";
export const dynamic = "force-dynamic";

/** Everything the builder needs for one scope: what is live, the saved draft, whether history exists. */
async function view(scope: string) {
  const docs = (await db.list<LayoutDoc>("product_layouts"));
  const d = docs.find((x) => x.id === scope) ?? null; const g = docs.find((x) => x.id === "global");
  return {
    scope, hasDraft: !!d?.draft, enabled: scope === "global" ? true : d?.enabled === true, hasPublished: !!d?.published, historyCount: d?.history.length ?? 0, version: d?.version ?? 0, updatedAt: d?.updatedAt ?? null, updatedBy: d?.updatedBy ?? null,
    editing: editorLayout(scope, docs), live: scope === "global" ? resolveLayout(d?.published, null).layout : resolveLayout(g?.published, d ? { enabled: d.enabled, published: d.published } : null).layout,
    globalLive: resolveLayout(g?.published, null).layout, defaults: defaultLayout(),
    overrides: docs.filter((x) => x.scope === "product" && x.enabled).map((x) => x.id),
  };
}
export const GET = handle(async (req) => {
  await requireAdmin(); const scope = new URL(req.url).searchParams.get("scope") || "global";
  if (!isScopeId(scope)) throw new ApiError(400, "Unknown layout scope");
  return ok(await view(scope));
});
const body = z.object({ scope: z.string().max(40), action: z.enum(["saveDraft", "publish", "discardDraft", "reset", "rollback", "setOverride"]), layout: z.unknown().optional(), enabled: z.boolean().optional() });
export const POST = handle(async (req) => {
  const a = await requireAdmin(); const b = body.parse(await readJson(req));
  switch (b.action) {
    case "saveDraft": await saveDraft(b.scope, b.layout, a.email); break;
    case "publish": await publish(b.scope, b.layout, a.email); break;
    case "discardDraft": await discardDraft(b.scope, a.email); break;
    case "reset": await resetScope(b.scope, a.email); break;
    case "rollback": await rollback(b.scope, a.email); break;
    case "setOverride": await setOverride(b.scope, b.enabled === true, a.email); break;
  }
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: `productpage.${b.action}`, target: b.scope });
  void getLayoutDoc; return ok(await view(b.scope));
});
