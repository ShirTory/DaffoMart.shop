import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { ApiError, handle } from "@/server/http";
export const dynamic = "force-dynamic";

/** Admin only. Private NID photo of an applicant: never public, never cached. */
export const GET = handle(async (_req, ctx) => {
  await requireAdmin();
  const { id, side } = await ctx.params;
  if (side !== "front" && side !== "back") throw new ApiError(404, "Not found");
  const d = await db.get<{ data: string }>("nid", `${id}-${side}`);
  if (!d) throw new ApiError(404, "NID photo not found");
  return new Response(new Uint8Array(Buffer.from(d.data, "base64")), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
});
