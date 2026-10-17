import { handle, ok, ApiError } from "@/server/http";
import { publicRider, requireRider } from "@/server/riderAuth";
import { db } from "@/server/db";
import { MAX_UPLOAD_BYTES, saveImage } from "@/server/storage";
import type { Rider } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(async () => ok(publicRider(await requireRider())));

/** Update own profile (image, vehicle, area). */
export const PATCH = handle(async (req) => {
  const r = await requireRider();
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const patch: Partial<Rider> = {};
    const vehicle = form.get("vehicle");
    if (typeof vehicle === "string") patch.vehicle = vehicle.trim().slice(0, 40);
    const area = form.get("area");
    if (typeof area === "string") patch.area = area.trim().slice(0, 80);
    const profile = form.get("image") || form.get("profile");
    if (profile instanceof File && profile.size) {
      if (profile.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "Image too large");
      const saved = await saveImage(Buffer.from(await profile.arrayBuffer()), "rider");
      patch.image = saved.url;
    }
    const next = await db.update<Rider>("riders", r.id, patch);
    return ok(publicRider(next!));
  }
  const body = await req.json().catch(() => ({}));
  const patch: Partial<Rider> = {};
  if (typeof body.vehicle === "string") patch.vehicle = body.vehicle.trim().slice(0, 40);
  if (typeof body.area === "string") patch.area = body.area.trim().slice(0, 80);
  if (typeof body.image === "string") patch.image = body.image || undefined;
  const next = await db.update<Rider>("riders", r.id, patch);
  return ok(publicRider(next!));
});
