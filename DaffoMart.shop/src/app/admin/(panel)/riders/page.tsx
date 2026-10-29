"use client";
import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, Icon, ImageUpload, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { riderApproved } from "@/lib/rider";
import type { Order, Rider } from "@/lib/types";

type Form = { name: string; phone: string; vehicle: string; area: string; note: string; active: boolean; password: string; image?: string };
const blank: Form = { name: "", phone: "", vehicle: "Motorbike", area: "", note: "", active: true, password: "", image: undefined };
const LIVE = new Set(["assigned", "picked_up", "on_the_way"]);

export default function RidersPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const riders = useList<Rider[]>("/api/riders"); const orders = useList<Order[]>("/api/orders");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"riders" | "apps">("riders");
  const [review, setReview] = useState<Rider | null>(null); const [rejecting, setRejecting] = useState(false); const [reason, setReason] = useState("");
  const stats = useMemo(() => { const m = new Map<string, { live: number; done: number }>(); for (const o of orders.data ?? []) { if (!o.riderId) continue; const s = m.get(o.riderId) ?? { live: 0, done: 0 }; if (LIVE.has(o.status)) s.live++; if (o.status === "delivered") s.done++; m.set(o.riderId, s); } return m; }, [orders.data]);
  const open = (r?: Rider) => { setErrs({}); setEdit(r ? { id: r.id, f: { name: r.name, phone: r.phone, vehicle: r.vehicle, area: r.area, note: r.note, active: r.active, password: "", image: r.image } } : { f: { ...blank } }); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const save = async () => {
    if (!edit) return; setBusy(true); setErrs({});
    try {
      const s = await api<Rider>(edit.id ? `/api/riders/${edit.id}` : "/api/riders", { method: edit.id ? "PUT" : "POST", body: { ...edit.f, password: edit.f.password || undefined } });
      riders.setData((d) => (edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [...(d ?? []), s]).sort((a, b) => a.name.localeCompare(b.name))); toast("Rider saved"); setEdit(null);
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (r: Rider) => {
    if ((stats.get(r.id)?.live ?? 0) > 0) return toast("This rider has deliveries in progress. Reassign them first.", "err");
    if (!(await confirm(`Delete rider "${r.name}"? Past orders keep the rider's name.`))) return;
    try { await api(`/api/riders/${r.id}`, { method: "DELETE" }); riders.setData((d) => d!.filter((x) => x.id !== r.id)); toast("Rider deleted"); } catch (e: any) { toast(e.message, "err"); }
  };
  const toggle = async (r: Rider, active: boolean) => {
    try { const s = await api<Rider>(`/api/riders/${r.id}`, { method: "PUT", body: { ...r, active } }); riders.setData((d) => d!.map((x) => (x.id === s.id ? s : x))); } catch (e: any) { toast(e.message, "err"); }
  };
  const all = riders.data ?? [];
  const list = all.filter(riderApproved);
  const apps = all.filter((r) => !riderApproved(r)).sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || (b.appliedAt ?? "").localeCompare(a.appliedAt ?? ""));
  const pendingCount = apps.filter((r) => r.status === "pending").length;
  const openReview = (r: Rider) => { setReview(r); setRejecting(false); setReason(""); };
  const decide = async (action: "approve" | "reject") => {
    if (!review) return;
    if (action === "reject" && reason.trim().length < 3) return toast("Write the reason for rejecting", "err");
    setBusy(true);
    try {
      const s = await api<Rider>(`/api/riders/${review.id}/review`, { method: "POST", body: action === "approve" ? { action } : { action, reason: reason.trim() } });
      riders.setData((d) => d!.map((x) => (x.id === s.id ? s : x)));
      toast(action === "approve" ? "Rider approved. They can sign in now." : "Application rejected"); setReview(null);
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const appsView = riders.loading ? <PageLoader /> : riders.error ? <ErrorBox msg={riders.error} retry={riders.reload} /> : !apps.length ? (
    <div className="card"><Empty icon="rider" title="No applications" hint="When someone applies at /rider/register the application appears here. Check the information and NID photos, then approve or reject." /></div>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {apps.map((r) => (
        <div key={r.id} className="card p-5">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><a href={`tel:${r.phone}`} className="text-sm text-primary">{r.phone}</a></div>
            <StatusBadge status={r.status === "rejected" ? "cancelled" : "pending"} label={r.status === "rejected" ? "Rejected" : "Pending review"} /></div>
          <p className="mt-3 text-xs text-gray-500">Applied {fmtDateTime(r.appliedAt)}</p>
          <p className="mt-1 text-xs text-gray-500">{[r.vehicle, r.area].filter(Boolean).join(" · ") || "—"}</p>
          {r.status === "rejected" && r.rejectReason && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Reason: {r.rejectReason}</p>}
          <div className="mt-4 flex gap-2">
            <button className={`${r.status === "rejected" ? "btn-outline" : "btn-primary"} btn-sm flex-1`} onClick={() => openReview(r)}>{r.status === "rejected" ? "View" : "Review"}</button>
            <a className="btn-outline btn-sm" href={`/admin/print/rider/${r.id}`} target="_blank" rel="noopener noreferrer">Print CV</a>
          </div>
        </div>))}
    </div>);
  const row = (label: string, value?: string, href?: string) => <div><p className="label">{label}</p>{href && value ? <a href={href} className="text-sm text-primary">{value}</a> : <p className="whitespace-pre-line text-sm">{value || "—"}</p>}</div>;
  return (
    <>
      <PageHeader title="Riders" subtitle="New riders apply at /rider/register. Check their information, then approve. Approved riders sign in at /rider/login"><button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add rider</button></PageHeader>
      <div className="mb-4 flex gap-2" role="tablist">
        <button role="tab" aria-selected={tab === "riders"} className={tab === "riders" ? "btn-primary btn-sm" : "btn-outline btn-sm"} onClick={() => setTab("riders")}>Riders ({list.length})</button>
        <button role="tab" aria-selected={tab === "apps"} className={tab === "apps" ? "btn-primary btn-sm" : "btn-outline btn-sm"} onClick={() => setTab("apps")}>Applications{pendingCount > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">{pendingCount}</span>}</button>
      </div>
      {tab === "apps" ? appsView : riders.loading ? <PageLoader /> : riders.error ? <ErrorBox msg={riders.error} retry={riders.reload} /> : !list.length ? <div className="card"><Empty icon="rider" title="No riders yet" hint="Add your delivery riders, then assign them to orders from the Orders page." action={<button className="btn-primary" onClick={() => open()}>Add rider</button>} /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => { const st = stats.get(r.id) ?? { live: 0, done: 0 }; return (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-lg font-bold text-primary">{r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" className="h-full w-full object-cover" />
                ) : r.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><a href={`tel:${r.phone}`} className="text-sm text-primary">{r.phone}</a></div></div>
                <StatusBadge status={!r.active ? "inactive" : st.live ? "on_the_way" : "active"} label={!r.active ? "Inactive" : st.live ? "On delivery" : "Available"} /></div>
              <p className="mt-3 text-xs text-gray-500">{[r.vehicle, r.area].filter(Boolean).join(" · ") || "—"}{r.locAt && Date.now() - new Date(r.locAt).getTime() < 900_000 && <span className="ml-2 font-semibold text-emerald-600">● sharing location</span>}</p>
              {r.ratingCount ? <p className="mt-1 text-xs font-semibold text-amber-600">★ {Number(r.ratingAvg).toFixed(1)} · {r.ratingCount} ratings</p> : null}{r.note && <p className="mt-1 text-xs text-gray-400">{r.note}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-lg bg-gray-50 p-2"><p className="text-base font-bold">{st.live}</p>Active orders</div><div className="rounded-lg bg-gray-50 p-2"><p className="text-base font-bold">{st.done}</p>Delivered</div></div>
              <div className="mt-4 flex items-center justify-between border-t pt-3"><Toggle checked={r.active} onChange={(v) => toggle(r, v)} label="Active" />
                <div><button className="btn-ghost btn-sm" onClick={() => open(r)} aria-label="Edit"><Icon name="edit" className="h-4 w-4" /></button><button className="btn-ghost btn-sm text-red-600" onClick={() => del(r)} aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></button></div></div>
            </div>); })}
        </div>)}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit rider" : "Add rider"}
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errs.name}><input className="input" value={edit.f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Mobile number" error={errs.phone}><input className="input" inputMode="numeric" value={edit.f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" /></Field>
          <Field label="Vehicle"><input className="input" value={edit.f.vehicle} onChange={(e) => set("vehicle", e.target.value)} placeholder="Motorbike / Bicycle" /></Field>
          <Field label="Working area"><input className="input" value={edit.f.area} onChange={(e) => set("area", e.target.value)} placeholder="e.g. Savar, Mirpur" /></Field>
          <Field label={edit.id ? "New password (optional)" : "Login password"} error={errs.password} hint={edit.id ? "Leave empty to keep the current password" : "Min 6 characters. The rider signs in with phone + this password."} className="sm:col-span-2"><input className="input" type="text" autoComplete="off" value={edit.f.password} onChange={(e) => set("password", e.target.value)} /></Field>
          <Field label="Note" className="sm:col-span-2"><input className="input" value={edit.f.note} onChange={(e) => set("note", e.target.value)} /></Field>
          <div className="sm:col-span-2"><ImageUpload kind="general" label="Profile photo" value={edit.f.image} onChange={(v) => set("image", v)} aspect="aspect-square" rounded="rounded-full" /></div>
          <div className="sm:col-span-2"><Toggle checked={edit.f.active} onChange={(v) => set("active", v)} label="Active (can be assigned to orders)" /></div>
        </div>}
      </Modal>
      <Modal wide open={!!review} onClose={() => !busy && setReview(null)} title={review ? `Application: ${review.name}` : "Application"}
        footer={review && (rejecting ? <><button className="btn-outline" onClick={() => setRejecting(false)} disabled={busy}>Back</button><button className="btn-danger" onClick={() => decide("reject")} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Confirm reject</button></>
          : <><button className="btn-outline" onClick={() => setReview(null)} disabled={busy}>Close</button>
            <a className="btn-outline" href={`/admin/print/rider/${review.id}`} target="_blank" rel="noopener noreferrer">Print CV</a>
            {review.status !== "rejected" && <button className="btn-danger" onClick={() => setRejecting(true)} disabled={busy}>Reject</button>}
            <button className="btn-primary" onClick={() => decide("approve")} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Approve</button></>)}>
        {review && <div className="space-y-5">
          {review.status === "rejected" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><b>Rejected{review.reviewedAt ? ` on ${fmtDateTime(review.reviewedAt)}` : ""}.</b> Reason: {review.rejectReason}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {row("Full name", review.name)}{row("Mobile (sign-in ID)", review.phone, `tel:${review.phone}`)}
            {row("NID number", review.nidNumber)}{row("Applied", fmtDateTime(review.appliedAt))}
            {row("Vehicle", review.vehicle)}{row("Working area", review.area)}
            {row("Date of birth", review.dateOfBirth)}{row("Gender", review.gender)}
            {row("Blood group", review.bloodGroup)}{row("Education", review.education)}
            {row("Father's name", review.fatherName)}{row("Mother's name", review.motherName)}
            {row("Experience (years)", review.experienceYears != null ? String(review.experienceYears) : undefined)}
            {row("Skills", review.skills)}{row("Languages", review.languages)}
            {row("Driving license", review.drivingLicense === true ? "Yes" : review.drivingLicense === false ? "No" : undefined)}
            {row("License number", review.licenseNumber)}
            {row("Expected salary", review.expectedSalary != null ? `৳ ${review.expectedSalary}` : undefined)}
            {row("Available from", review.availableFrom)}{row("Preferred shift", review.preferredShift)}
            {row("Emergency contact", review.emergencyContact)}{row("Emergency phone", review.emergencyPhone)}
            <div className="sm:col-span-2">{row("Permanent address", review.permanentAddress)}</div>
            <div className="sm:col-span-2">{row("Present address", review.presentAddress)}</div>
            {review.previousJobs && <div className="sm:col-span-2">{row("Previous jobs", review.previousJobs)}</div>}
            {row("Referrer", review.referrerName)}{row("Referrer mobile", review.referrerPhone, review.referrerPhone ? `tel:${review.referrerPhone}` : undefined)}
            {review.referrerRelation && row("Relation with rider", review.referrerRelation)}
          </div>
          <div><p className="label">NID photos (tap to open full size)</p>
            <div className="grid gap-3 sm:grid-cols-2">{(["front", "back"] as const).map((side) => (
              <a key={side} href={`/api/riders/${review.id}/nid/${side}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/riders/${review.id}/nid/${side}`} alt={`NID ${side}`} loading="lazy" className="aspect-[16/10] w-full object-contain" />
                <p className="border-t py-1.5 text-center text-xs font-semibold capitalize text-gray-500">{side}</p></a>))}</div></div>
          {rejecting && <Field label="Reason for rejecting (shown to the applicant)"><textarea className="input" rows={2} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. NID photo is not clear, please apply again" /></Field>}
        </div>}
      </Modal>
      {node}
    </>
  );
}
