import { handle, ok, ApiError } from "@/server/http";
import { getEmployee, publicEmployee, requireEmployee } from "@/server/riderAuth";
import { db } from "@/server/db";
import { MAX_UPLOAD_BYTES, isOwnUpload, saveImage } from "@/server/storage";
import type { Employee } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = handle(async () => ok(publicEmployee(await requireEmployee())));
export const PATCH = handle(async (req) => {
  const e = await requireEmployee();
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const patch: Partial<Employee> = {};
    const name = form.get("name");
    if (typeof name === "string" && name.trim().length >= 2) patch.name = name.trim();
    const profile = form.get("image") || form.get("profile");
    if (profile instanceof File && profile.size) {
      if (profile.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "Image too large");
      const r = await saveImage(Buffer.from(await profile.arrayBuffer()), "employee");
      patch.image = r.url;
    }
    const next = await db.update<Employee>("employees", e.id, patch);
    return ok(publicEmployee(next!));
  }
  const body = await req.json().catch(() => ({}));
  const patch: Partial<Employee> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) patch.name = body.name.trim();
  if (typeof body.image === "string") { if (body.image && !isOwnUpload(body.image)) throw new ApiError(400, "Invalid image"); patch.image = body.image || undefined; }
  const next = await db.update<Employee>("employees", e.id, patch);
  return ok(publicEmployee(next!));
});
