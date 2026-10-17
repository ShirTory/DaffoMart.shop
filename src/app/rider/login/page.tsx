"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Icon, Spinner } from "@/components/admin/ui";

export default function RiderLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await api("/api/rider/login", { method: "POST", body: { phone, password } }); router.replace("/rider"); router.refresh(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-deeper via-primary-dark to-primary px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop sm:p-8">
        <Image src="/logo-horizontal.png" alt="DaffoMart" width={778} height={168} className="h-10 w-auto" priority />
        <h1 className="mt-6 text-2xl font-bold">Rider sign in 🛵</h1><p className="mt-1 text-sm text-gray-500">Sign in with the mobile number and password you registered with. Only approved riders can sign in.</p>
        <div className="mt-5 space-y-4">
          <div><label className="label">Mobile number</label><input className="input" inputMode="numeric" autoComplete="username" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /></div>
          <div><label className="label">Password</label><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{busy ? "Signing in…" : "Sign in"}</button>
        </div>
        <p className="mt-5 text-center text-sm text-gray-500">New rider? <a href="/rider/register" className="font-semibold text-primary">Apply here</a></p>
        <a href="/" className="mt-3 block text-center text-sm text-gray-500 hover:text-primary">← Back to store</a>
      </form>
    </div>
  );
}
