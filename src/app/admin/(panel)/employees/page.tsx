"use client";
import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, Icon, ImageUpload, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { taka } from "@/lib/format";
import { EMPLOYEE_ROLES, type Employee, type Rider } from "@/lib/types";

type Form = { name: string; role: string; phone: string; email: string; department: string; joinedAt: string; salary: string; note: string; active: boolean; riderId?: string; image?: string };
const blank = (): Form => ({ name: "", role: "Operations", phone: "", email: "", department: "", joinedAt: new Date().toISOString().slice(0, 10), salary: "", note: "", active: true, image: undefined });

export default function EmployeesPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const { data, setData, loading, error, reload } = useList<Employee[]>("/api/employees");
  const riders = useList<Rider[]>("/api/riders");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const [role, setRole] = useState("all"); const [q, setQ] = useState("");
  const list = useMemo(() => (data ?? []).filter((e) => (role === "all" || e.role === role) && (!q || `${e.name} ${e.phone} ${e.role}`.toLowerCase().includes(q.toLowerCase()))), [data, role, q]);
  const roles = useMemo(() => ["all", ...Array.from(new Set([...EMPLOYEE_ROLES, ...(data ?? []).map((e) => e.role)]))].filter((r) => r === "all" || (data ?? []).some((e) => e.role === r)), [data]);
  const open = (e?: Employee) => { setErrs({}); setEdit({ id: e?.id, f: e ? { name: e.name, role: e.role, phone: e.phone, email: e.email ?? "", department: e.department ?? "", joinedAt: e.joinedAt ?? "", salary: e.salary ? String(e.salary) : "", note: e.note ?? (e as { notes?: string }).notes ?? "", active: e.active, riderId: e.riderId, image: e.image } : blank() }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const sortList = (l: Employee[]) => [...l].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const s = await api<Employee>(edit.id ? `/api/employees/${edit.id}` : "/api/employees", { method: edit.id ? "PUT" : "POST", body: { ...edit.f, joinedAt: edit.f.joinedAt || undefined } });
      setData((d) => sortList(edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [...(d ?? []), s])); toast("Employee saved"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (e: Employee) => { if (!(await confirm(`Delete ${e.name}? Their attendance records are deleted too. (Deactivate instead to keep the history.)`))) return; try { await api(`/api/employees/${e.id}`, { method: "DELETE" }); setData((d) => d!.filter((x) => x.id !== e.id)); toast("Employee deleted"); } catch (x: any) { toast(x.message, "err"); } };
  const syncRiders = async () => {
    const missing = (riders.data ?? []).filter((r) => r.active && !(data ?? []).some((e) => e.riderId === r.id));
    if (!missing.length) return toast("All riders are already on the staff list");
    setBusy(true); try { const made: Employee[] = []; for (const r of missing) made.push(await api<Employee>("/api/employees", { method: "POST", body: { name: r.name, role: "Rider", phone: r.phone, email: "", note: [r.vehicle, r.area].filter(Boolean).join(" · "), active: true, riderId: r.id } })); setData((d) => sortList([...(d ?? []), ...made])); toast(`${made.length} rider(s) added`); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };

  const decideEmp = async (e: Employee, action: "approve" | "reject") => {
    let reason = "";
    if (action === "reject") {
      reason = prompt("Reason for rejecting?") || "";
      if (reason.trim().length < 3) return toast("Write a short reason", "err");
    }
    setBusy(true);
    try {
      const s = await api<Employee>(`/api/employees/${e.id}/review`, { method: "POST", body: action === "approve" ? { action } : { action, reason: reason.trim() } });
      setData((d) => d!.map((x) => (x.id === s.id ? s : x)));
      toast(action === "approve" ? "Employee approved" : "Application rejected");
    } catch (x: any) { toast(x.message, "err"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Staff" subtitle="Everyone who works for the business — from the CEO to riders">
        <button className="btn-outline" onClick={syncRiders} disabled={busy || riders.loading}>Add riders to staff</button>
        <button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add employee</button>
      </PageHeader>
      <div className="card overflow-hidden">
        <div className="space-y-2 border-b p-4">
          <div className="scroll-thin flex gap-1 overflow-x-auto pb-1">{roles.map((r) => <button key={r} onClick={() => setRole(r)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${role === r ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>{r === "all" ? `All (${data?.length ?? 0})` : r}</button>)}</div>
          <div className="relative max-w-sm"><Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search name, role or phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {loading ? <PageLoader /> : error ? <div className="p-4"><ErrorBox msg={error} retry={reload} /></div> : !list.length ? <Empty icon="rider" title={data?.length ? "No one matches" : "No staff added yet"} hint="Add the CEO, managers, packers, support and riders to track their attendance." action={!data?.length ? <button className="btn-primary" onClick={() => open()}>Add first employee</button> : undefined} /> : (
          <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[720px]"><thead className="bg-gray-50"><tr><th className="th">Name</th><th className="th">Role</th><th className="th">Phone</th><th className="th">Joined</th><th className="th">Salary</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody className="divide-y">{list.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50"><td className="td"><div className="flex items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-sm font-bold text-primary">{e.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" className="h-full w-full object-cover" />
                ) : e.name.charAt(0).toUpperCase()}</span><div><p className="font-medium">{e.name}</p>{e.email && <p className="text-xs text-gray-500">{e.email}</p>}</div></div></td><td className="td">{e.role}</td><td className="td">{e.phone ? <a className="text-primary" href={`tel:${e.phone}`}>{e.phone}</a> : "—"}</td><td className="td text-gray-500">{e.joinedAt || "—"}</td><td className="td">{e.salary ? taka(e.salary) : "—"}</td>
                <td className="td">{e.status === "pending" ? <StatusBadge status="pending" label="Pending" /> : e.status === "rejected" ? <StatusBadge status="cancelled" label="Rejected" /> : <StatusBadge status={e.active ? "active" : "inactive"} label={e.active ? "Active" : "Inactive"} />}</td>
                <td className="td text-right whitespace-nowrap">
                  <a className="btn-ghost btn-sm" href={`/admin/print/employee/${e.id}`} target="_blank" rel="noopener noreferrer" title="Print CV">Print</a>
                  {e.status === "pending" && (
                    <>
                      <button className="btn-ghost btn-sm text-emerald-600" onClick={() => decideEmp(e, "approve")} disabled={busy}>Approve</button>
                      <button className="btn-ghost btn-sm text-red-600" onClick={() => decideEmp(e, "reject")} disabled={busy}>Reject</button>
                    </>
                  )}
                  <button className="btn-ghost btn-sm" onClick={() => open(e)} aria-label="Edit"><Icon name="edit" className="h-4 w-4" /></button>
                  <button className="btn-ghost btn-sm text-red-600" onClick={() => del(e)} aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></button>
                </td></tr>))}</tbody></table></div>)}
      </div>
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit employee" : "Add employee"} footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errs.name}><input className="input" value={edit.f.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Role / position" error={errs.role}><input className="input" list="roles" value={edit.f.role} onChange={(e) => set("role", e.target.value)} /><datalist id="roles">{EMPLOYEE_ROLES.map((r) => <option key={r} value={r} />)}</datalist></Field>
              <Field label="Phone" error={errs.phone}><input className="input" value={edit.f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" /></Field>
              <Field label="Email" error={errs.email}><input className="input" type="email" value={edit.f.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Department" hint="Optional" error={errs.department}><input className="input" value={edit.f.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Operations" /></Field>
              <Field label="Joining date" error={errs.joinedAt}><input className="input" type="date" value={edit.f.joinedAt} onChange={(e) => set("joinedAt", e.target.value)} /></Field>
              <Field label="Monthly salary (৳)" hint="Optional · only admins see this" error={errs.salary}><input className="input" type="number" min="0" value={edit.f.salary} onChange={(e) => set("salary", e.target.value)} /></Field>
            </div>
            {edit.f.role === "Rider" && <Field label="Linked rider account" hint="So the rider's own Check-in button in the rider app records here"><select className="input" value={edit.f.riderId ?? ""} onChange={(e) => set("riderId", e.target.value || undefined)}><option value="">— none —</option>{riders.data?.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.phone}</option>)}</select></Field>}
            <Field label="Note"><textarea className="input min-h-[64px]" value={edit.f.note} onChange={(e) => set("note", e.target.value)} /></Field>
            <ImageUpload kind="general" label="Profile photo" value={edit.f.image} onChange={(v) => set("image", v)} aspect="aspect-square" rounded="rounded-full" />
            <Toggle checked={edit.f.active} onChange={(v) => set("active", v)} label="Active (appears in attendance)" />
          </div>)}
      </Modal>
      {node}
    </>
  );
}
