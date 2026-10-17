import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { riderCfg } from "@/server/resources";
import { riderReviewSchema } from "@/lib/validators";
import { riderApproved } from "@/lib/rider";
import type { Rider } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Admin only. { action: "approve" } or { action: "reject", reason }. */
export const POST = handle(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const r = await db.get<Rider>("riders", id);
  if (!r) throw new ApiError(404, "Application not found");
  if (riderApproved(r)) throw new ApiError(409, "This rider is already approved");
  const body = riderReviewSchema.parse(await readJson(req));
  const reviewedAt = new Date().toISOString();
  const next = body.action === "approve"
    ? await db.update<Rider>("riders", id, { status: "approved", active: true, reviewedAt, rejectReason: undefined })
    : await db.update<Rider>("riders", id, { status: "rejected", active: false, reviewedAt, rejectReason: body.reason });
  return ok(riderCfg.present(next!));
});
