"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Field, Icon, Spinner } from "@/components/admin/ui";

type F = {
  name: string; phone: string; password: string; password2: string;
  nidNumber: string; permanentAddress: string; presentAddress: string;
  vehicle: string; area: string;
  referrerName: string; referrerPhone: string; referrerRelation: string;
  // CV
  dateOfBirth: string; gender: string; bloodGroup: string;
  fatherName: string; motherName: string;
  education: string; experienceYears: string; previousJobs: string; skills: string; languages: string;
  emergencyContact: string; emergencyPhone: string;
  drivingLicense: string; licenseNumber: string;
  expectedSalary: string; availableFrom: string; preferredShift: string;
};
const blank: F = {
  name: "", phone: "", password: "", password2: "",
  nidNumber: "", permanentAddress: "", presentAddress: "",
  vehicle: "Motorbike", area: "",
  referrerName: "", referrerPhone: "", referrerRelation: "",
  dateOfBirth: "", gender: "", bloodGroup: "",
  fatherName: "", motherName: "",
  education: "", experienceYears: "", previousJobs: "", skills: "", languages: "",
  emergencyContact: "", emergencyPhone: "",
  drivingLicense: "", licenseNumber: "",
  expectedSalary: "", availableFrom: "", preferredShift: "",
};

/** Shrinks a phone photo in the browser (max 1600 px JPEG) so the upload is small and fast. */
async function shrink(file: File, max = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file for the NID photo");
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file; // the server validates it anyway
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.82));
  return blob ? new File([blob], "nid.jpg", { type: "image/jpeg" }) : file;
}

function Photo({ label, file, onPick, error }: { label: string; file: File | null; onPick: (f: File | null) => void; error?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (!file) { setUrl(""); return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <Field label={label} error={error}>
      <label className="flex aspect-[16/10] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-center text-sm text-gray-500 transition hover:border-primary hover:bg-primary-soft">
        {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={label} className="h-full w-full object-cover" /> : <span className="px-4">📷 Tap to take a photo or choose a file</span>}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </label>
    </Field>
  );
}

export default function RiderRegister() {
  const [f, setF] = useState<F>(blank); const [front, setFront] = useState<File | null>(null); const [back, setBack] = useState<File | null>(null); const [profile, setProfile] = useState<File | null>(null);
  const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [errs, setErrs] = useState<Record<string, string>>({}); const [done, setDone] = useState(false);
  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setErrs({});
    if (f.password !== f.password2) return setErrs({ password2: "Passwords do not match" });
    if (!front || !back) return setErr("Upload both the front and the back photo of your NID card");
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(f)) if (k !== "password2") fd.append(k, v);
      fd.append("nidFront", await shrink(front)); fd.append("nidBack", await shrink(back));
      if (profile) fd.append("image", await shrink(profile));
      const res = await fetch("/api/rider/register", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { if (json?.details && typeof json.details === "object") setErrs(json.details); throw new Error(json?.error ?? `Could not send your application (${res.status})`); }
      setDone(true); window.scrollTo({ top: 0 });
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-primary-deeper via-primary-dark to-primary px-4 py-8">{children}</div>
  );
  if (done) return shell(
    <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-pop">
      <p className="text-5xl">✅</p><h1 className="mt-3 text-2xl font-bold">Application sent</h1>
      <p className="mt-2 text-sm text-gray-600">Thank you! The store will check your information and NID photos manually. You can sign in with your mobile number and password <b>after your application is approved</b>.</p>
      <a href="/rider/login" className="btn-primary mt-6 w-full py-2.5">Go to rider sign in</a>
    </div>);

  return shell(
    <form onSubmit={submit} className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-pop sm:p-8">
      <Image src="/logo-horizontal.png" alt="DaffoMart" width={778} height={168} className="h-10 w-auto" priority />
      <h1 className="mt-6 text-2xl font-bold">Become a rider 🛵</h1>
      <p className="mt-1 text-sm text-gray-500">Fill in all the information. The store checks every application by hand before you can sign in.</p>

      <h2 className="mt-6 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Your details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errs.name}><input className="input" required value={f.name} onChange={set("name")} autoComplete="name" /></Field>
        <Field label="Mobile number" error={errs.phone} hint="This will be your sign-in ID"><input className="input" required inputMode="numeric" value={f.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" autoComplete="tel" /></Field>
        <Field label="Password" error={errs.password} hint="At least 6 characters"><input className="input" type="password" required minLength={6} value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={errs.password2}><input className="input" type="password" required value={f.password2} onChange={set("password2")} autoComplete="new-password" /></Field>
        <Field label="Vehicle" error={errs.vehicle}><input className="input" value={f.vehicle} onChange={set("vehicle")} placeholder="Motorbike / Bicycle" /></Field>
        <Field label="Working area" error={errs.area}><input className="input" value={f.area} onChange={set("area")} placeholder="e.g. Savar, Mirpur" /></Field>
      </div>

      <h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Address</h2>
      <div className="mt-4 grid gap-4">
        <Field label="Permanent address" error={errs.permanentAddress}><textarea className="input" rows={2} required value={f.permanentAddress} onChange={set("permanentAddress")} placeholder="Village / road, post office, upazila, district" /></Field>
        <Field label="Present address" error={errs.presentAddress}><textarea className="input" rows={2} required value={f.presentAddress} onChange={set("presentAddress")} placeholder="Where you live now" /></Field>
      </div>

      <h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Referrer (someone who knows you)</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Referrer name" error={errs.referrerName}><input className="input" required value={f.referrerName} onChange={set("referrerName")} /></Field>
        <Field label="Referrer mobile number" error={errs.referrerPhone}><input className="input" required inputMode="numeric" value={f.referrerPhone} onChange={set("referrerPhone")} placeholder="01XXXXXXXXX" /></Field>
        <Field label="Relation with you" error={errs.referrerRelation} className="sm:col-span-2"><input className="input" value={f.referrerRelation} onChange={set("referrerRelation")} placeholder="e.g. Neighbour, Uncle, Employer" /></Field>
      </div>

      <h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Profile photo</h2>
      <div className="mt-4 max-w-xs">
        <Photo label="Your photo (optional — shown to customers)" file={profile} onPick={setProfile} />
      </div>

<h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">National ID (NID)</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="NID number" error={errs.nidNumber} hint="10, 13 or 17 digits" className="sm:col-span-2"><input className="input" required inputMode="numeric" value={f.nidNumber} onChange={set("nidNumber")} /></Field>
        <Photo label="NID front photo" file={front} onPick={setFront} />
        <Photo label="NID back photo" file={back} onPick={setBack} />
      </div>
      <p className="mt-2 text-xs text-gray-500">🔒 Your NID photos are private. Only the store admin can see them.</p>

      <h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Personal information (for hiring)</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth"><input className="input" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
        <Field label="Gender">
          <select className="input" value={f.gender} onChange={set("gender")}>
            <option value="">Select…</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Blood group">
          <select className="input" value={f.bloodGroup} onChange={set("bloodGroup")}>
            <option value="">Select…</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Father's name"><input className="input" value={f.fatherName} onChange={set("fatherName")} /></Field>
        <Field label="Mother's name"><input className="input" value={f.motherName} onChange={set("motherName")} /></Field>
        <Field label="Emergency contact name"><input className="input" value={f.emergencyContact} onChange={set("emergencyContact")} /></Field>
        <Field label="Emergency phone"><input className="input" inputMode="numeric" value={f.emergencyPhone} onChange={set("emergencyPhone")} placeholder="01XXXXXXXXX" /></Field>
      </div>

      <h2 className="mt-8 border-b pb-2 text-sm font-bold uppercase tracking-wide text-primary">Professional information</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Education"><input className="input" value={f.education} onChange={set("education")} placeholder="e.g. HSC, Bachelor" /></Field>
        <Field label="Experience (years)"><input className="input" type="number" min={0} value={f.experienceYears} onChange={set("experienceYears")} placeholder="0" /></Field>
        <Field label="Skills" className="sm:col-span-2"><input className="input" value={f.skills} onChange={set("skills")} placeholder="e.g. Driving, Navigation, Customer service" /></Field>
        <Field label="Languages"><input className="input" value={f.languages} onChange={set("languages")} placeholder="Bangla, English" /></Field>
        <Field label="Driving license?">
          <select className="input" value={f.drivingLicense} onChange={set("drivingLicense")}>
            <option value="">Select…</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
        <Field label="License number"><input className="input" value={f.licenseNumber} onChange={set("licenseNumber")} /></Field>
        <Field label="Expected salary (৳)"><input className="input" type="number" min={0} value={f.expectedSalary} onChange={set("expectedSalary")} /></Field>
        <Field label="Available from"><input className="input" type="date" value={f.availableFrom} onChange={set("availableFrom")} /></Field>
        <Field label="Preferred shift">
          <select className="input" value={f.preferredShift} onChange={set("preferredShift")}>
            <option value="">Any</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
            <option value="Night">Night</option>
            <option value="Full day">Full day</option>
          </select>
        </Field>
        <Field label="Previous jobs / work history" className="sm:col-span-2"><textarea className="input" rows={2} value={f.previousJobs} onChange={set("previousJobs")} placeholder="Company, role, duration…" /></Field>
      </div>

      <label className="mt-6 flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I confirm that all the information and photos above are true and belong to me.</label>
      {err && <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
      <button className="btn-primary mt-5 w-full py-3" disabled={busy || !agree}>{busy && <Spinner className="h-4 w-4" />}{busy ? "Sending…" : "Submit application"}</button>
      <p className="mt-4 text-center text-sm text-gray-500">Already approved? <a href="/rider/login" className="font-semibold text-primary">Sign in</a></p>
    </form>);
}
