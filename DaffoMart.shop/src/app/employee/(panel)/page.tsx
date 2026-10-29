"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { id: string; name: string; phone: string; role: string; email?: string; image?: string; department?: string };

export default function EmployeePanel() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/employee/me").then((r) => r.json()).then((d) => {
      if (d?.id) setMe(d); else router.replace("/employee/login");
    }).catch(() => router.replace("/employee/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/employee/logout", { method: "POST" });
    router.replace("/employee/login");
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true); setErr("");
    const fd = new FormData();
    fd.append("image", f);
    try {
      const r = await fetch("/api/employee/me", { method: "PATCH", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Upload failed");
      setMe(d);
    } catch (ex: any) { setErr(ex.message); }
    finally { setUploading(false); }
  }

  if (!me) return <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-gray-50 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Employee Panel</h1>
        <button onClick={logout} className="text-sm font-semibold text-red-600">Sign out</button>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-2xl font-bold text-primary ring-2 ring-primary/20">
              {me.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.image} alt={me.name} className="h-full w-full object-cover" />
              ) : me.name.charAt(0).toUpperCase()}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onImage} disabled={uploading} />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{uploading ? "…" : "Edit"}</span>
          </label>
          <div>
            <p className="text-lg font-bold text-gray-900">{me.name}</p>
            <p className="text-sm text-gray-500">{me.role}{me.department ? ` · ${me.department}` : ""}</p>
            <p className="text-sm text-gray-500">{me.phone}</p>
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </div>
      <p className="mt-6 text-center text-sm text-gray-400">Contact admin for assigned tasks.</p>
    </div>
  );
}
