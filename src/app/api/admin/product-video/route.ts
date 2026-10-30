import { requireAdmin } from "@/server/auth";
import { ApiError, handle, ok } from "@/server/http";
import { finishVideoUpload, saveVideoLocal, videoMode, videoUploadUrl } from "@/server/video";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const NOT_AVAILABLE = "Uploading videos needs Firebase Storage (a Blaze plan with FIREBASE_STORAGE_BUCKET set). Until then, paste a YouTube, Vimeo or .mp4 link instead.";
export const GET = handle(async () => { await requireAdmin(); return ok({ mode: videoMode() }); });
/** JSON {action:"init", contentType, size} -> signed URL;  {action:"finish", name} -> permanent URL;  multipart file=<video> -> local development upload. */
export const POST = handle(async (req) => {
  await requireAdmin(); const mode = videoMode();
  if (mode === "none") throw new ApiError(501, NOT_AVAILABLE);
  if ((req.headers.get("content-type") || "").includes("application/json")) {
    if (mode !== "bucket") throw new ApiError(400, "Direct upload is only used with Firebase Storage.");
    const b = await req.json().catch(() => ({} as any));
    if (b.action === "init") return ok(await videoUploadUrl(String(b.contentType), Number(b.size)));
    if (b.action === "finish") return ok(await finishVideoUpload(String(b.name)));
    throw new ApiError(400, "Unknown action");
  }
  if (mode !== "local") throw new ApiError(400, "Use the direct upload for this deployment.");
  const f = (await req.formData().catch(() => { throw new ApiError(400, "Send the video as multipart/form-data"); })).get("file");
  if (!(f instanceof File)) throw new ApiError(400, "No video received");
  return ok(await saveVideoLocal(Buffer.from(await f.arrayBuffer())), 201);
});
