import { handle, ok, ApiError } from "@/server/http";
import { listPublic, submitReview, REVIEW_IMAGES_MAX } from "@/server/reviews";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Public: approved reviews only, newest first, paged. Nothing private is returned. */
export const GET = handle(async (req, ctx) => {
  const { id } = await ctx.params; const u = new URL(req.url).searchParams;
  const offset = Math.max(0, Math.floor(Number(u.get("offset")) || 0)), limit = Math.min(20, Math.max(1, Math.floor(Number(u.get("limit")) || 5)));
  return ok(await listPublic(id, offset, limit));
});
/** Public, multipart/form-data: orderNo, phone, rating, title?, text, images[] (max 3). Needs a delivered order that contains the product. */
export const POST = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const f = await req.formData().catch(() => { throw new ApiError(400, "Send the review as a form."); });
  const files: Buffer[] = [];
  for (const v of f.getAll("images")) { if (v instanceof File && v.size > 0) { if (files.length >= REVIEW_IMAGES_MAX) throw new ApiError(400, `You can add at most ${REVIEW_IMAGES_MAX} photos.`); files.push(Buffer.from(await v.arrayBuffer())); } }
  const s = (k: string) => String(f.get(k) ?? "");
  return ok(await submitReview(req, id, { orderNo: s("orderNo"), phone: s("phone"), rating: Number(s("rating")), title: s("title"), text: s("text") }, files), 201);
});
