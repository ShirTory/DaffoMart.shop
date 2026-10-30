import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { resetSeo, saveSeo } from "@/server/seo";
import { logAudit } from "@/server/audit";
import { handle, ok, readJson } from "@/server/http";
export const dynamic = "force-dynamic";
const body = z.object({ title: z.string().max(200).optional(), description: z.string().max(500).optional(), keywords: z.string().max(600).optional(), image: z.string().max(500).optional(), canonical: z.string().max(500).optional(), noindex: z.boolean().optional() });
export const PUT = handle(async (req, ctx) => {
  const a = await requireAdmin(); const { key } = await ctx.params;
  const r = await saveSeo(decodeURIComponent(key), body.parse(await readJson(req)), a.email);
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "seo.save", target: decodeURIComponent(key), detail: r?.noindex ? "noindex" : "" });
  return ok(r);
});
export const DELETE = handle(async (_r, ctx) => { const a = await requireAdmin(); const { key } = await ctx.params; await resetSeo(decodeURIComponent(key)); await logAudit({ actor: a.email, actorRole: a.adminRole, action: "seo.reset", target: decodeURIComponent(key) }); return ok({ key }); });
