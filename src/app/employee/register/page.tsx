"use client";
import { useState } from "react";
import Image from "next/image";
import { Icon, Spinner } from "@/components/admin/ui";
import { EMPLOYEE_ROLES } from "@/lib/types";

const blank = {
  name: "", phone: "", password: "", email: "", role: "", department: "", note: "",
  nidNumber: "", permanentAddress: "", presentAddress: "",
  dateOfBirth: "", gender: "", bloodGroup: "",
  fatherName: "", motherName: "",
  education: "", experienceYears: "", previousJobs: "", skills: "", languages: "",
  emergencyContact: "", emergencyPhone: "",
  expectedSalary: "", availableFrom: "", preferredShift: "",
};

export default function EmployeeRegister() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [form, setForm] = useState(blank);
  const [image, setImage] = useState<File | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image) fd.append("image", image);
      const r = await fetch("/api/employee/register", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Could not submit");
      setOk(true);
    } catch (x: any) { setErr(x.message); }
    finally { setBusy(false); }
  };

  if (ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-deeper via-primary-dark to-primary px-5 py-10">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-pop">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
          <h1 className="mt-4 text-xl font-bold">Application submitted</h1>
          <p className="mt-2 text-sm text-gray-500">An admin will review your application. You can sign in once approved.</p>
          <a href="/employee/login" className="btn-primary mt-6 inline-flex px-6 py-2.5">Go to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-deeper via-primary-dark to-primary px-4 py-8">
      <form onSubmit={submit} className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-pop sm:p-8">
        <Image src="/logo-horizontal.png" alt="DaffoMart" width={778} height={168} className="h-10 w-auto" priority />
        <h1 className="mt-6 text-2xl font-bold">Join as staff</h1>
        <p className="mt-1 text-sm text-gray-500">Apply for a position. Admin will approve before you can sign in. Extra details help with hiring decisions.</p>

        <h2 className="mt-6 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Account & role</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="label">Full name</label><input className="input" required value={form.name} onChange={set("name")} /></div>
          <div><label className="label">Mobile number</label><input className="input" inputMode="numeric" required value={form.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" /></div>
          <div><label className="label">Password (min 6)</label><input className="input" type="password" required minLength={6} value={form.password} onChange={set("password")} /></div>
          <div><label className="label">Email (optional)</label><input className="input" type="email" value={form.email} onChange={set("email")} /></div>
          <div>
            <label className="label">Position / role</label>
            <select className="input" required value={form.role} onChange={set("role")}>
              <option value="">Select…</option>
              {EMPLOYEE_ROLES.filter((r) => r !== "Rider").map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className="label">Department (optional)</label><input className="input" value={form.department} onChange={set("department")} /></div>
          <div className="sm:col-span-2"><label className="label">Profile photo (optional)</label><input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files?.[0] || null)} /></div>
        </div>

        <h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Personal information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="label">Date of birth</label><input className="input" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} /></div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={set("gender")}>
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Blood group</label>
            <select className="input" value={form.bloodGroup} onChange={set("bloodGroup")}>
              <option value="">Select…</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div><label className="label">NID number</label><input className="input" value={form.nidNumber} onChange={set("nidNumber")} /></div>
          <div><label className="label">Father&apos;s name</label><input className="input" value={form.fatherName} onChange={set("fatherName")} /></div>
          <div><label className="label">Mother&apos;s name</label><input className="input" value={form.motherName} onChange={set("motherName")} /></div>
          <div><label className="label">Emergency contact</label><input className="input" value={form.emergencyContact} onChange={set("emergencyContact")} /></div>
          <div><label className="label">Emergency phone</label><input className="input" inputMode="numeric" value={form.emergencyPhone} onChange={set("emergencyPhone")} placeholder="01XXXXXXXXX" /></div>
          <div className="sm:col-span-2"><label className="label">Permanent address</label><textarea className="input" rows={2} value={form.permanentAddress} onChange={set("permanentAddress")} /></div>
          <div className="sm:col-span-2"><label className="label">Present address</label><textarea className="input" rows={2} value={form.presentAddress} onChange={set("presentAddress")} /></div>
        </div>

        <h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Professional information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="label">Education</label><input className="input" value={form.education} onChange={set("education")} placeholder="e.g. HSC, Bachelor" /></div>
          <div><label className="label">Experience (years)</label><input className="input" type="number" min={0} value={form.experienceYears} onChange={set("experienceYears")} /></div>
          <div className="sm:col-span-2"><label className="label">Skills</label><input className="input" value={form.skills} onChange={set("skills")} placeholder="e.g. Excel, Customer support, Inventory" /></div>
          <div><label className="label">Languages</label><input className="input" value={form.languages} onChange={set("languages")} placeholder="Bangla, English" /></div>
          <div><label className="label">Expected salary (৳)</label><input className="input" type="number" min={0} value={form.expectedSalary} onChange={set("expectedSalary")} /></div>
          <div><label className="label">Available from</label><input className="input" type="date" value={form.availableFrom} onChange={set("availableFrom")} /></div>
          <div>
            <label className="label">Preferred shift</label>
            <select className="input" value={form.preferredShift} onChange={set("preferredShift")}>
              <option value="">Any</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
              <option value="Full day">Full day</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Previous jobs / work history</label><textarea className="input" rows={2} value={form.previousJobs} onChange={set("previousJobs")} placeholder="Company, role, duration…" /></div>
          <div className="sm:col-span-2"><label className="label">Note</label><textarea className="input" rows={2} value={form.note} onChange={set("note")} /></div>
        </div>

        {err && <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
        <button className="btn-primary mt-6 w-full py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{busy ? "Submitting…" : "Submit application"}</button>
        <p className="mt-5 text-center text-sm text-gray-500">Already applied? <a href="/employee/login" className="font-semibold text-primary">Sign in</a></p>
        <a href="/" className="mt-3 block text-center text-sm text-gray-500 hover:text-primary">← Back to store</a>
      </form>
    </div>
  );
}
