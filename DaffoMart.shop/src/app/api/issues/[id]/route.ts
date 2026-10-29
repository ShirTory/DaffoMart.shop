import { db } from "@/server/db";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { issuePatchSchema } from "@/lib/validators";
import type { OrderIssue } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const PATCH = handle(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = issuePatchSchema.parse(await readJson(req));
  const cur = await db.get<OrderIssue>("issues", id);
  if (!cur) throw new ApiError(404, "Issue not found");
  const next: OrderIssue = {
    ...cur,
    ...(body.status ? { status: body.status } : {}),
    ...(body.adminNote !== undefined ? { adminNote: body.adminNote } : {}),
    updatedAt: new Date().toISOString(),
  };
  await db.put("issues", next);
  return ok(next);
});
