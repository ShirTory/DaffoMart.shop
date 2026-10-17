"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Icon, Spinner } from "@/components/admin/ui";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await api("/api/auth/login", { method: "POST", body: { email, password } }); router.replace("/admin"); router.refresh(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-deeper via-primary-dark to-primary p-12 text-white lg:flex">
        <div className="w-fit rounded-2xl bg-white px-5 py-3"><Image src="/logo-horizontal.png" alt="DaffoMart" width={778} height={168} className="h-12 w-auto" priority /></div>
        <div><h2 className="text-4xl font-extrabold leading-tight">Run your store<br />from one dashboard.</h2>
          <p className="mt-4 max-w-md text-white/70">Manage products, orders, cover images and offers — all in one secure place.</p>
          <div className="mt-8 flex gap-3 text-sm">{["Orders", "Inventory", "Offers", "Analytics"].map((t) => <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-white/80">{t}</span>)}</div></div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} DaffoMart. All rights reserved.</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="flex items-center justify-center bg-gray-50 px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Image src="/logo-horizontal.png" alt="DaffoMart" width={778} height={168} className="h-11 w-auto" priority /></div>
          <h1 className="text-2xl font-bold text-gray-900">Admin sign in</h1>
          <p className="mt-1 text-sm text-gray-500">Enter your credentials to access the dashboard.</p>
          <div className="mt-6 space-y-4">
            <div><label className="label">Email</label><input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourstore.com" /></div>
            <div><label className="label">Password</label>
              <div className="relative"><input className="input pr-16" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 hover:text-primary">{show ? "Hide" : "Show"}</button></div></div>
            {err && <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
            <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : null}{busy ? "Signing in…" : "Sign in"}</button>
          </div>
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-sm font-semibold text-gray-800">Rider / Employee?</p>
            <p className="mt-0.5 text-xs text-gray-500">Apply for an account. An admin will approve it before you can sign in.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href="/rider/register" className="btn-primary py-2 text-sm">Register</a>
              <a href="/rider/login" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary">Rider sign in</a>
            </div>
          </div>
          <a href="/" className="mt-6 block text-center text-sm text-gray-500 hover:text-primary">← Back to store</a>
        </form>
      </div>
    </div>
  );
}
