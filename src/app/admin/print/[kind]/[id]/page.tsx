"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ApplicationCV from "@/components/admin/ApplicationCV";
import { api } from "@/lib/api";
import type { Employee, Rider } from "@/lib/types";

export default function PrintApplicationPage() {
  const params = useParams();
  const kind = String(params.kind || "");
  const id = String(params.id || "");
  const [person, setPerson] = useState<(Rider | Employee) | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id || (kind !== "rider" && kind !== "employee")) {
      setErr("Invalid link");
      return;
    }
    const path = kind === "rider" ? `/api/riders/${id}` : `/api/employees/${id}`;
    api<Rider | Employee>(path)
      .then((d) => setPerson(d))
      .catch((e: any) => setErr(e.message || "Failed to load"));
  }, [kind, id]);

  if (err) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="rounded-lg bg-red-50 p-4 text-red-700">{err}</p>
      </div>
    );
  }
  if (!person) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">Loading application…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Screen-only toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm print:hidden">
        <div>
          <p className="text-sm font-bold text-gray-900">Print application (CV layout)</p>
          <p className="text-xs text-gray-500">{person.name} · {kind}</p>
        </div>
        <div className="flex gap-2">
          <a href={kind === "rider" ? "/admin/riders" : "/admin/employees"} className="btn-outline btn-sm">
            Back
          </a>
          <button type="button" className="btn-primary btn-sm" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl py-6 print:py-0">
        <ApplicationCV
          person={{ ...person, kind: kind as "rider" | "employee" }}
          storeName="DaffoMart"
        />
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 12mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
