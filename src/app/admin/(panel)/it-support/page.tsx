"use client";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { ErrorBox, Field, PageHeader, PageLoader, Spinner, Toggle, useConfirm, useToast } from "@/components/admin/ui";

type Acc = { id: string; email: string; role: string; fullAccess: boolean; active: boolean; note?: string; hasPassword?: boolean; grantedBy?: string; grantedAt?: string };

export default function ItSupportPage() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [list, setList] = useState<Acc[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "it_support", fullAccess: false, note: "", active: true });

  const load = async () => {
    try { setList(await api<Acc[]>("/api/admin/accounts")); setErr(""); }
    catch (e: any) { setErr(e.message || "Failed"); setList([]); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      await api("/api/admin/accounts", { method: "POST", body: { email: form.email, role: form.role, fullAccess: form.role === "accountant" ? false : form.fullAccess, active: form.active, note: form.note, password: form.password } });
      toast(form.role === "accountant" ? "Accountant account created" : "IT Support account created");
      setForm({ email: "", password: "", role: "it_support", fullAccess: false, note: "", active: true });
      await load();
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const toggleAccess = async (a: Acc) => {
    setBusy(true);
    try {
      await api(`/api/admin/accounts/${a.id}`, { method: "PUT", body: { email: a.email, role: a.role, fullAccess: !a.fullAccess, active: a.active, note: a.note } });
      toast(a.fullAccess ? "Full access revoked" : "Full Admin access granted");
      await load();
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const remove = async (a: Acc) => {
    if (!(await confirm(`Remove ${a.email}? They will lose admin login immediately.`))) return;
    try { await api(`/api/admin/accounts/${a.id}`, { method: "DELETE" }); toast("Removed"); await load(); }
    catch (e: any) { toast(e.message, "err"); }
  };

  if (list === null && !err) return <PageLoader />;
  return (
    <>
      <PageHeader title="IT Support & permissions" subtitle="Owner-only. Grant or revoke full Admin Panel access for IT Support. Access is explicit, auditable, and revocable. Secrets stay in server env." />
      {err && <ErrorBox msg={err} retry={load} />}
      <div className="card mb-6 space-y-4 p-5">
        <h2 className="font-bold">Add IT Support or Accountant account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role" hint="Accountant sees Finance & Accounts only (no orders, products, settings, NID or staff data)."><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="it_support">IT Support</option><option value="accountant">Accountant</option></select></Field>
          <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="it@yourdomain.com" /></Field>
          <Field label="Password (min 8)"><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Note" className="sm:col-span-2"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
        <Toggle checked={form.fullAccess} onChange={(v) => setForm({ ...form, fullAccess: v })} label="Grant full Admin Panel access (explicit)" />
        <button className="btn-primary" disabled={busy || !form.email || form.password.length < 8} onClick={create}>{busy && <Spinner className="h-4 w-4" />}Create account</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="th">Email</th><th className="th">Role</th><th className="th">Full access</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
          <tbody className="divide-y">
            {(list || []).length === 0 && <tr><td colSpan={5} className="td text-gray-500">No IT Support accounts yet. Env ADMIN_EMAIL remains the Owner.</td></tr>}
            {(list || []).map((a) => (
              <tr key={a.id}>
                <td className="td font-medium">{a.email}</td>
                <td className="td">{a.role}</td>
                <td className="td"><Toggle checked={a.fullAccess} onChange={() => toggleAccess(a)} label={a.fullAccess ? "Yes" : "No"} /></td>
                <td className="td">{a.active ? "Active" : "Disabled"}</td>
                <td className="td text-right"><button className="btn-ghost btn-sm text-red-600" onClick={() => remove(a)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {node}
    </>
  );
}
