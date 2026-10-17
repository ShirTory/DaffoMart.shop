"use client";
import { useMemo, useState } from "react";
import { ErrorBox, Icon, PageHeader, PageLoader, Spinner } from "@/components/admin/ui";
import { useSettingsForm } from "@/components/admin/useSettingsForm";
import { TEXT_DEFS } from "@/lib/texts";

export default function TextsPage() {
  const { f, set, save, busy, loading, error, reload } = useSettingsForm(["texts"]);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, typeof TEXT_DEFS>();
    for (const d of TEXT_DEFS) { if (q && !`${d.label} ${d.def} ${d.group}`.toLowerCase().includes(q.toLowerCase())) continue; m.set(d.group, [...(m.get(d.group) ?? []), d]); }
    return [...m.entries()];
  }, [q]);
  if (loading) return <PageLoader />; if (error || !f) return <ErrorBox msg={error || "Failed to load"} retry={reload} />;
  const texts = f.texts ?? {};
  const setText = (k: string, v: string) => { const n = { ...texts }; if (v) n[k] = v; else delete n[k]; set("texts", n); };
  const changed = Object.keys(texts).length;
  return (
    <>
      <PageHeader title="Website Text" subtitle="Change the wording of buttons, titles, menus and messages. Leave a box empty to use the default.">
        <button className="btn-primary" onClick={() => save()} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save changes</button>
      </PageHeader>
      <p className="mb-4 rounded-xl bg-primary-soft p-3 text-sm text-primary-dark">Other text is edited in: <a className="font-semibold underline" href="/admin/content">Website Content</a> (hero, tagline, features, footer text) · <a className="font-semibold underline" href="/admin/settings">Settings &amp; Contact</a> (contact info, return &amp; exchange policy) · <a className="font-semibold underline" href="/admin/categories">Categories</a> (category titles &amp; descriptions) · <a className="font-semibold underline" href="/admin/invoice-settings">Invoice</a>.</p>
      <div className="relative mb-5 max-w-sm"><Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search text…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="space-y-5">
        {groups.map(([g, defs]) => (
          <section key={g} className="card p-5">
            <h2 className="mb-3 font-bold">{g}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {defs.map((d) => (
                <div key={d.key} className={d.long ? "md:col-span-2" : ""}>
                  <div className="flex items-center justify-between"><label className="label" htmlFor={d.key}>{d.label}</label>{texts[d.key] && <button type="button" className="mb-1 text-xs font-semibold text-primary hover:underline" onClick={() => setText(d.key, "")}>Reset</button>}</div>
                  {d.long ? <textarea id={d.key} className="input min-h-[64px]" maxLength={400} value={texts[d.key] ?? ""} placeholder={d.def} onChange={(e) => setText(d.key, e.target.value)} />
                    : <input id={d.key} className="input" maxLength={400} value={texts[d.key] ?? ""} placeholder={d.def} onChange={(e) => setText(d.key, e.target.value)} />}
                </div>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <p className="py-10 text-center text-gray-500">No text matches “{q}”.</p>}
      </div>
      <p className="mt-4 text-xs text-gray-400">{changed} customised · the rest use the default wording.</p>
    </>
  );
}
