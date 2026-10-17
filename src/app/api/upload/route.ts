import { requireAdmin } from "@/server/auth";
import { ApiError, handle, ok } from "@/server/http";
import { MAX_UPLOAD_BYTES, saveImage } from "@/server/storage";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin only. multipart/form-data: file=<image>, kind=product|banner|category|offer */
export const POST = handle(async (req) => {
  await requireAdmin();
  const form = await req.formData().catch(() => { throw new ApiError(400, "Send the image as multipart/form-data"); });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "No image file received");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `Image is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`);
  const kind = String(form.get("kind") ?? "general");
  const r = await saveImage(Buffer.from(await file.arrayBuffer()), kind);
  return ok(r, 201);
});
