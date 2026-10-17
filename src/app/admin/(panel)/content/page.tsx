"use client";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { ErrorBox, Field, Icon, ImageUpload, PageHeader, PageLoader, Spinner, Toggle, useList, useToast } from "@/components/admin/ui";
import type { Feature, JobPosition, StoreSettings } from "@/lib/types";
import { FEATURE_ICON_KEYS } from "@/components/store/FeatureIcon";

type F = Pick<StoreSettings, "logo" | "heroTitle" | "heroSubtitle" | "heroCta" | "features" | "showMedicine" | "medicineTitle" | "medicineSubtitle" | "medicineNotice" | "footerText" | "positions" | "joinTitle" | "joinIntro">;
export default function ContentPage() {
  const toast = useToast(); const { data, loading, error, reload } = useList<StoreSettings>("/api/settings");
  const [f, setF] = useState<F | null>(null); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setF({ logo: data.logo, heroTitle: data.heroTitle, heroSubtitle: data.heroSubtitle, heroCta: data.heroCta, features: data.features, showMedicine: data.showMedicine, medicineTitle: data.medicineTitle, medicineSubtitle: data.medicineSubtitle, medicineNotice: data.medicineNotice, footerText: data.footerText, positions: data.positions ?? [], joinTitle: data.joinTitle, joinIntro: data.joinIntro }); }, [data]);
  if (loading) return <PageLoader />; if (error || !f) return <ErrorBox msg={error || "Failed to load"} retry={reload} />;
  const set = <K extends keyof F>(k: K, v: F[K]) => setF({ ...f, [k]: v });
  const txt = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const feat = (i: number, patch: Partial<Feature>) => set("features", f.features.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const pos = (i: number, patch: Partial<JobPosition>) => set("positions", (f.positions ?? []).map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const save = async () => {
    setBusy(true); setErrs({});
    try { await api("/api/settings", { method: "PUT", body: { ...f, positions: (f.positions ?? []).filter((x) => x.title.trim()) } }); toast("Website content saved"); } catch (x: any) { if (x instanceof ApiClientError) setErrs(x.fields); toast(x.message, "err"); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Website content" subtitle="Edit the texts, logo and sections customers see on your website"><a href="/" target="_blank" className="btn-outline"><Icon name="external" className="h-4 w-4" />Preview store</a><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save changes</button></PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5"><h2 className="font-bold">Logo</h2>
          <ImageUpload kind="general" label="Store logo (optional)" value={f.logo || undefined} onChange={(v) => set("logo", v ?? "")} aspect="aspect-[4/1]" rounded="rounded-lg" hint="Wide logo on a transparent or white background. Leave empty to use the default DaffoMart logo." />
          <Field label="Footer description" hint="Short text under the logo in the footer. Empty = use tagline."><textarea className="input" rows={2} value={f.footerText} onChange={txt("footerText")} /></Field>
        </section>
        <section className="card space-y-4 p-5"><h2 className="font-bold">Home page banner text</h2>
          <p className="-mt-2 text-xs text-gray-500">Shown when there are no cover images. Manage sliders in “Cover Images”.</p>
          <Field label="Heading" error={errs.heroTitle} hint="Press Enter for a new line"><textarea className="input" rows={2} value={f.heroTitle} onChange={txt("heroTitle")} /></Field>
          <Field label="Sub-heading"><input className="input" value={f.heroSubtitle} onChange={txt("heroSubtitle")} /></Field>
          <Field label="Button text"><input className="input" value={f.heroCta} onChange={txt("heroCta")} placeholder="Shop now" /></Field>
        </section>
        <section className="card space-y-4 p-5 lg:col-span-2"><div className="flex items-center justify-between"><h2 className="font-bold">💊 Medicine section</h2><Toggle checked={f.showMedicine} onChange={(v) => set("showMedicine", v)} label="Show on website" /></div>
          <p className="-mt-2 text-xs text-gray-500">Create categories with section type “Medicine” in Categories, then add medicine products — they appear here, highlighted in green, and on the /medicine page.</p>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Section title"><input className="input" value={f.medicineTitle} onChange={txt("medicineTitle")} /></Field><Field label="Section sub-title"><input className="input" value={f.medicineSubtitle} onChange={txt("medicineSubtitle")} /></Field>
            <Field label="Notice (e.g. prescription rule)" className="sm:col-span-2"><textarea className="input" rows={2} value={f.medicineNotice} onChange={txt("medicineNotice")} /></Field></div>
        </section>
        <section className="card space-y-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Job positions (Join our team)</h2>
              <p className="text-xs text-gray-500">People open <b>/join</b>, choose a position and apply. “Rider” positions use the rider application form, “Staff” positions use the staff form. Switch all positions off to stop hiring (the footer link disappears).</p>
            </div>
            <button className="btn-outline btn-sm shrink-0" onClick={() => set("positions", [...(f.positions ?? []), { id: "p" + Date.now().toString(36), title: "", kind: "staff", description: "", active: true }])}>
              <Icon name="plus" className="h-4 w-4" />Add position
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Page title"><input className="input" value={f.joinTitle ?? ""} onChange={txt("joinTitle")} placeholder="Join our team" /></Field>
            <Field label="Intro text"><input className="input" value={f.joinIntro ?? ""} onChange={txt("joinIntro")} placeholder="Choose the position you want to apply for." /></Field>
          </div>
          <div className="space-y-3">
            {(f.positions ?? []).map((p, i) => (
              <div key={p.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_170px_auto]">
                  <Field label="Position title"><input className="input" maxLength={40} placeholder="e.g. Customer Support" value={p.title} onChange={(e) => pos(i, { title: e.target.value })} /></Field>
                  <Field label="Application form">
                    <select className="input" value={p.kind} onChange={(e) => pos(i, { kind: e.target.value === "rider" ? "rider" : "staff" })}>
                      <option value="staff">Staff form</option>
                      <option value="rider">Rider form</option>
                    </select>
                  </Field>
                  <div className="flex items-end gap-2 pb-1">
                    <Toggle checked={p.active} onChange={(v) => pos(i, { active: v })} label="Open" />
                    <button className="btn-ghost btn-sm text-red-600" onClick={() => set("positions", (f.positions ?? []).filter((_, k) => k !== i))} aria-label="Remove"><Icon name="trash" className="h-4 w-4" /></button>
                  </div>
                </div>
                <Field label="Short description (optional)" className="mt-3"><input className="input" maxLength={240} value={p.description ?? ""} onChange={(e) => pos(i, { description: e.target.value })} placeholder="What will they do? Any requirements?" /></Field>
              </div>
            ))}
            {(f.positions ?? []).length === 0 && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">No positions yet. Click “Add position”.</p>}
          </div>
        </section>
        <section className="card space-y-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Highlights strip</h2>
              <p className="text-xs text-gray-500">Professional icons on the home page (no emoji). Pick an icon style or upload a custom image.</p>
            </div>
            {f.features.length < 6 && (
              <button className="btn-outline btn-sm" onClick={() => set("features", [...f.features, { icon: "check", title: "", text: "" }])}>
                <Icon name="plus" className="h-4 w-4" />Add
              </button>
            )}
          </div>
          <div className="space-y-4">
            {f.features.map((x, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Title">
                    <input className="input" placeholder="e.g. Fast delivery" value={x.title} onChange={(e) => feat(i, { title: e.target.value })} />
                  </Field>
                  <Field label="Short text">
                    <input className="input" placeholder="e.g. Same-day in Dhaka" value={x.text} onChange={(e) => feat(i, { text: e.target.value })} />
                  </Field>
                  <div className="flex items-end">
                    <button className="btn-ghost btn-sm text-red-600" onClick={() => set("features", f.features.filter((_, k) => k !== i))} aria-label="Remove">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                  <Field label="Icon style">
                    <select className="input" value={x.icon || "check"} onChange={(e) => feat(i, { icon: e.target.value })}>
                      {FEATURE_ICON_KEYS.map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <ImageUpload
                    kind="general"
                    label="Custom icon image (optional)"
                    hint="Overrides the style above. Square PNG/WebP works best."
                    value={x.image}
                    onChange={(v) => feat(i, { image: v || undefined })}
                    aspect="aspect-square"
                    rounded="rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
