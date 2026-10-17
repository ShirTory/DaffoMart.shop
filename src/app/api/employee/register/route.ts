import { db, newId } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import { hashPassword } from "@/server/riderAuth";
import { MAX_UPLOAD_BYTES, saveImage } from "@/server/storage";
import { employeeApplySchema } from "@/lib/validators";
import type { Employee } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  rateLimit(`emp-apply:${clientIp(req)}`, 5, 60 * 60_000);
  const form = await req.formData().catch(() => { throw new ApiError(400, "Send the form as multipart/form-data"); });
  const text = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : ""; };
  const d = employeeApplySchema.parse({
    name: text("name"), phone: text("phone").replace(/\s|-/g, ""), password: text("password"),
    email: text("email") || undefined, role: text("role"), department: text("department") || undefined, note: text("note") || "",
    nidNumber: text("nidNumber").replace(/\s/g, "") || undefined,
    permanentAddress: text("permanentAddress") || undefined, presentAddress: text("presentAddress") || undefined,
    dateOfBirth: text("dateOfBirth") || undefined, gender: text("gender") || undefined, bloodGroup: text("bloodGroup") || undefined,
    fatherName: text("fatherName") || undefined, motherName: text("motherName") || undefined,
    education: text("education") || undefined, experienceYears: text("experienceYears") || undefined,
    previousJobs: text("previousJobs") || undefined, skills: text("skills") || undefined, languages: text("languages") || undefined,
    emergencyContact: text("emergencyContact") || undefined, emergencyPhone: text("emergencyPhone").replace(/\s|-/g, "") || undefined,
    expectedSalary: text("expectedSalary") || undefined, availableFrom: text("availableFrom") || undefined, preferredShift: text("preferredShift") || undefined,
  });
  const existing = (await db.list<Employee>("employees")).find((e) => e.phone === d.phone);
  if (existing && existing.status === "pending") throw new ApiError(409, "You have already applied with this number. Your application is under review.");
  if (existing && existing.status !== "rejected" && existing.active) throw new ApiError(409, "This mobile number is already registered.");
  let image: string | undefined;
  const profile = form.get("image") || form.get("profile");
  if (profile instanceof File && profile.size) {
    if (profile.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `Profile image must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
    const r = await saveImage(Buffer.from(await profile.arrayBuffer()), "employee");
    image = r.url;
  }
  const id = existing?.id ?? newId();
  const at = new Date().toISOString();
  const { password, ...info } = d;
  const rec: Employee = {
    ...info, id, email: info.email || "", active: false, status: "pending",
    passHash: hashPassword(password), hasPassword: true, appliedAt: at,
    createdAt: existing?.createdAt ?? at, image, note: info.note || "",
  };
  await db.put("employees", rec);
  return ok({ submitted: true }, 201);
});
