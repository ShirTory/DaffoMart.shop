import { db, newId } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import { hashPassword } from "@/server/riderAuth";
import { MAX_NID_BYTES, MAX_UPLOAD_BYTES, prepareNid, saveImage } from "@/server/storage";
import { riderApplySchema } from "@/lib/validators";
import type { Rider } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public. multipart/form-data: the text fields of riderApplySchema + nidFront + nidBack (images).
 *  Creates an inactive "pending" rider; an admin must approve it before the rider can sign in. */
export const POST = handle(async (req) => {
  rateLimit(`rider-apply:${clientIp(req)}`, 5, 60 * 60_000);
  const form = await req.formData().catch(() => { throw new ApiError(400, "Send the form as multipart/form-data"); });
  const text = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : ""; };
  const bool = (k: string) => text(k) === "true" || text(k) === "1" || text(k) === "on";
  const d = riderApplySchema.parse({
    name: text("name"), phone: text("phone").replace(/\s|-/g, ""), password: text("password"), nidNumber: text("nidNumber").replace(/\s/g, ""),
    permanentAddress: text("permanentAddress"), presentAddress: text("presentAddress"), vehicle: text("vehicle"), area: text("area"),
    referrerName: text("referrerName"), referrerPhone: text("referrerPhone").replace(/\s|-/g, ""), referrerRelation: text("referrerRelation"),
    dateOfBirth: text("dateOfBirth"), gender: text("gender"), bloodGroup: text("bloodGroup"),
    fatherName: text("fatherName"), motherName: text("motherName"),
    education: text("education"), experienceYears: text("experienceYears") || undefined,
    previousJobs: text("previousJobs"), skills: text("skills"), languages: text("languages"),
    emergencyContact: text("emergencyContact"), emergencyPhone: text("emergencyPhone").replace(/\s|-/g, ""),
    drivingLicense: bool("drivingLicense"), licenseNumber: text("licenseNumber"),
    expectedSalary: text("expectedSalary") || undefined, availableFrom: text("availableFrom"), preferredShift: text("preferredShift"),
  });
  const front = form.get("nidFront"), back = form.get("nidBack");
  if (!(front instanceof File) || !(back instanceof File) || !front.size || !back.size) throw new ApiError(400, "Upload both the front and the back photo of your NID card");
  for (const f of [front, back]) if (f.size > MAX_NID_BYTES) throw new ApiError(413, `Each NID photo must be under ${MAX_NID_BYTES / 1024 / 1024} MB`);

  const existing = (await db.list<Rider>("riders")).find((r) => r.phone === d.phone);
  if (existing && existing.status === "pending") throw new ApiError(409, "You have already applied with this number. Your application is under review.");
  if (existing && existing.status !== "rejected") throw new ApiError(409, "This mobile number is already registered. Please sign in.");

  const [f, b] = await Promise.all([prepareNid(Buffer.from(await front.arrayBuffer())), prepareNid(Buffer.from(await back.arrayBuffer()))]);
  const id = existing?.id ?? newId(); const at = new Date().toISOString();
  await db.put("nid", { id: `${id}-front`, data: f.toString("base64"), size: f.length, createdAt: at });
  await db.put("nid", { id: `${id}-back`, data: b.toString("base64"), size: b.length, createdAt: at });
  let image: string | undefined;
  const profile = form.get("image") || form.get("profile");
  if (profile instanceof File && profile.size) {
    if (profile.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `Profile image must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
    const r = await saveImage(Buffer.from(await profile.arrayBuffer()), "rider");
    image = r.url;
  }
  const { password, ...info } = d;
  const rec: Rider = { ...info, id, note: "", active: false, status: "pending", passHash: hashPassword(password), hasNid: true, appliedAt: at, createdAt: existing?.createdAt ?? at, image };
  await db.put("riders", rec); // a rejected applicant who re-applies replaces the old record
  return ok({ submitted: true }, 201);
});
