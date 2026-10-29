import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { employeeReviewSchema } from "@/lib/validators";
import { employeeCfg } from "@/server/resources";
import type { Employee } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Admin only. { action: "approve" } or { action: "reject", reason }. */
export const POST = handle(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const e = await db.get<Employee>("employees", id);
  if (!e) throw new ApiError(404, "Application not found");
  if (e.status === "approved" || (!e.status && e.active)) throw new ApiError(409, "This employee is already approved");
  const body = employeeReviewSchema.parse(await readJson(req));
  const reviewedAt = new Date().toISOString();
  const next = body.action === "approve"
    ? await db.update<Employee>("employees", id, { status: "approved", active: true, reviewedAt, rejectReason: undefined })
    : await db.update<Employee>("employees", id, { status: "rejected", active: false, reviewedAt, rejectReason: body.reason });
  return ok(employeeCfg.present(next!));
});
