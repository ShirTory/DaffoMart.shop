import { db } from "@/server/db";
import { requireOwner } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { ApiError, handle } from "@/server/http";
export const dynamic = "force-dynamic";

/** Owner only (IT Support and Accountant accounts are refused). Private NID photo: never public, never cached, every view is audit-logged. */
export const GET = handle(async (_req, ctx) => {
  const admin = await requireOwner();
  const { id, side } = await ctx.params;
  if (side !== "front" && side !== "back") throw new ApiError(404, "Not found");
  const d = await db.get<{ data: string }>("nid", `${id}-${side}`);
  if (!d) throw new ApiError(404, "NID photo not found");
  await logAudit({ actor: admin.email, actorRole: admin.adminRole, action: "nid.view", target: `${id}/${side}` });
  return new Response(new Uint8Array(Buffer.from(d.data, "base64")), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
});
