"use client";
import type { Employee, Rider } from "@/lib/types";

type Person = Partial<Rider & Employee> & {
  id: string;
  name: string;
  phone: string;
  kind?: "rider" | "employee";
};

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === "") return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div className="flex gap-2 border-b border-gray-100 py-1.5 text-sm">
      <span className="w-40 shrink-0 font-medium text-gray-500">{label}</span>
      <span className="flex-1 text-gray-900">{display}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-2 border-b-2 border-primary pb-1 text-xs font-bold uppercase tracking-wider text-primary">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

/** Print-friendly CV-style layout for rider / employee applications. */
export default function ApplicationCV({ person, storeName = "DaffoMart" }: { person: Person; storeName?: string }) {
  const isRider = person.kind === "rider" || "vehicle" in person;
  const title = isRider ? "Rider Application" : "Employee Application";
  const role = isRider ? (person.vehicle || "Rider") : (person.role || "Staff");

  return (
    <div className="application-cv mx-auto max-w-[210mm] bg-white p-6 text-gray-900 sm:p-8 print:max-w-none print:p-0">
      {/* Header */}
      <header className="flex items-start gap-5 border-b-2 border-gray-200 pb-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200">
          {person.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.image} alt={person.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-gray-400">{person.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{storeName} · {title}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">{person.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {role}
            {person.department ? ` · ${person.department}` : ""}
            {person.area ? ` · ${person.area}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            <span>📱 {person.phone}</span>
            {person.email && <span>✉ {person.email}</span>}
            {person.nidNumber && <span>NID: {person.nidNumber}</span>}
            {person.status && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold uppercase">
                {person.status}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mt-2 grid gap-x-8 sm:grid-cols-2">
        <Section title="Personal information">
          <Row label="Date of birth" value={person.dateOfBirth} />
          <Row label="Gender" value={person.gender} />
          <Row label="Blood group" value={person.bloodGroup} />
          <Row label="Father's name" value={person.fatherName} />
          <Row label="Mother's name" value={person.motherName} />
          <Row label="Emergency contact" value={person.emergencyContact} />
          <Row label="Emergency phone" value={person.emergencyPhone} />
        </Section>

        <Section title="Address">
          <Row label="Permanent" value={person.permanentAddress} />
          <Row label="Present" value={person.presentAddress} />
        </Section>
      </div>

      <Section title="Professional / experience">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <Row label="Education" value={person.education} />
          <Row label="Experience (years)" value={person.experienceYears} />
          <Row label="Skills" value={person.skills} />
          <Row label="Languages" value={person.languages} />
          <Row label="Expected salary" value={person.expectedSalary != null ? `৳ ${person.expectedSalary}` : undefined} />
          <Row label="Available from" value={person.availableFrom} />
          <Row label="Preferred shift" value={person.preferredShift} />
          {isRider && (
            <>
              <Row label="Vehicle" value={person.vehicle} />
              <Row label="Working area" value={person.area} />
              <Row label="Driving license" value={person.drivingLicense} />
              <Row label="License number" value={person.licenseNumber} />
            </>
          )}
        </div>
        {person.previousJobs && (
          <div className="mt-2">
            <p className="text-xs font-medium text-gray-500">Previous jobs / work history</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">{person.previousJobs}</p>
          </div>
        )}
      </Section>

      {(person.referrerName || person.referrerPhone) && (
        <Section title="Referrer">
          <Row label="Name" value={person.referrerName} />
          <Row label="Phone" value={person.referrerPhone} />
          <Row label="Relation" value={person.referrerRelation} />
        </Section>
      )}

      {person.note && (
        <Section title="Additional note">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{person.note}</p>
        </Section>
      )}

      <footer className="mt-8 border-t pt-3 text-[11px] text-gray-400">
        Applied: {person.appliedAt ? new Date(person.appliedAt).toLocaleString() : "—"}
        {person.reviewedAt ? ` · Reviewed: ${new Date(person.reviewedAt).toLocaleString()}` : ""}
        {" · "}ID: {person.id}
        <span className="float-right print:inline">Generated for hiring review · {storeName}</span>
      </footer>
    </div>
  );
}
