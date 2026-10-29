"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, ImageUpload, Icon, Modal, PageHeader, PageLoader, Spinner, StatusBadge, Thumb, Toggle, useConfirm, useList, useToast } from "@/components/admin/ui";
import type { Category } from "@/lib/types";

type Form = {
  name: string; emoji: string; image?: string;
  coverImage?: string; description?: string; coverOverlay?: string; coverHeight?: string;
  coverTextColor?: string; coverBg?: string; coverPosition?: string; coverTitle?: string; hideOnHome?: boolean; iconBg?: string;
  kind: "grocery" | "medicine"; active: boolean; sortOrder: string;
};

export default function CategoriesPage() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const { data, setData, loading, error, reload } = useList<Category[]>("/api/categories");
  const [edit, setEdit] = useState<{ id?: string; f: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const open = (c?: Category) => {
    setErrs({});
    setEdit(
      c
        ? {
            id: c.id,
            f: {
              name: c.name, emoji: c.emoji, image: c.image,
              coverImage: c.coverImage, description: c.description || "",
              coverOverlay: c.coverOverlay || "medium", coverHeight: c.coverHeight || "md",
              coverTextColor: c.coverTextColor || "", coverBg: c.coverBg || "", coverPosition: c.coverPosition || "center", coverTitle: c.coverTitle || "", hideOnHome: !!c.hideOnHome, iconBg: c.iconBg || "",
              kind: c.kind ?? "grocery", active: c.active, sortOrder: String(c.sortOrder),
            },
          }
        : {
            f: {
              name: "", emoji: "🛍️", kind: "grocery", active: true,
              sortOrder: String((data?.length ?? 0) + 1),
              description: "", coverOverlay: "medium", coverHeight: "md", coverPosition: "center", coverTextColor: "", coverBg: "", coverTitle: "", hideOnHome: false, iconBg: "",
            },
          }
    );
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdit((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setErrs({});
    try {
      const s = await api<Category>(edit.id ? `/api/categories/${edit.id}` : "/api/categories", {
        method: edit.id ? "PUT" : "POST",
        body: edit.f,
      });
      setData((d) => {
        const l = edit.id ? d!.map((x) => (x.id === s.id ? s : x)) : [...(d ?? []), s];
        return l.sort((a, b) => a.sortOrder - b.sortOrder);
      });
      toast("Category saved");
      setEdit(null);
    } catch (e: any) {
      if (e instanceof ApiClientError) setErrs(e.fields);
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const ordered = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  /** what the home page category strip shows, in this order */
  const onHome = ordered.filter((c) => c.active && c.kind !== "medicine" && !c.hideOnHome);
  /** Move one category earlier / later. The new order is saved at once, so the storefront follows the admin's order. */
  const move = async (c: Category, dir: -1 | 1) => {
    const i = ordered.findIndex((x) => x.id === c.id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    const next = [...ordered]; [next[i], next[j]] = [next[j], next[i]];
    const before = data;
    setData(next.map((x, n) => ({ ...x, sortOrder: n + 1 })));
    try { await api("/api/categories/reorder", { method: "POST", body: { ids: next.map((x) => x.id) } }); }
    catch (e: any) { setData(before ?? []); toast(e.message, "err"); }
  };
  /** Quick on/off without opening the editor. */
  const quick = async (c: Category, patch: Partial<Category>) => {
    try { const s = await api<Category>(`/api/categories/${c.id}`, { method: "PUT", body: { ...c, ...patch } }); setData((d) => d!.map((x) => (x.id === s.id ? s : x))); toast("Saved"); }
    catch (e: any) { toast(e.message, "err"); }
  };

  const del = async (c: Category) => {
    if (!(await confirm(`Delete category "${c.name}"?`))) return;
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      setData((d) => d!.filter((x) => x.id !== c.id));
      toast("Category deleted");
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  return (
    <>
      <PageHeader title="Categories" subtitle="Icons, covers, and landing text for each shop section">
        <button className="btn-primary" onClick={() => open()}><Icon name="plus" className="h-4 w-4" />Add category</button>
      </PageHeader>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBox msg={error} retry={reload} />
      ) : !data?.length ? (
        <Empty title="No categories" action={<button className="btn-primary" onClick={() => open()}>Add first</button>} />
      ) : (
        <>
        <div className="card mb-4 p-4">
          <p className="text-sm font-bold">Home page order <span className="font-normal text-gray-500">— exactly what customers see in the category strip, left to right</span></p>
          {onHome.length ? <ol className="scroll-thin mt-3 flex gap-3 overflow-x-auto pb-1">{onHome.map((c, n) => (
            <li key={c.id} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center"><Thumb src={c.image} emoji={(c.name || "?").charAt(0).toUpperCase()} className="h-12 w-12 rounded-full text-base font-bold" /><span className="line-clamp-2 text-[11px] leading-tight text-gray-600">{n + 1}. {c.name}</span></li>))}</ol>
            : <p className="mt-2 text-xs text-amber-700">No category is switched on for the home page.</p>}
          <p className="mt-2 text-xs text-gray-500">Use the ↑ ↓ buttons on a category to change its position; use “On home page” to show or hide it there.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((c, idx) => (
            <div key={c.id} className="card flex flex-wrap gap-3 p-4">
              <Thumb src={c.image} emoji={(c.name || "?").charAt(0).toUpperCase()} className="h-16 w-16 rounded-full text-xl font-bold" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-gray-500">Position {idx + 1}</p>
                <div className="mt-1">
                  <StatusBadge status={c.active ? "active" : "inactive"} label={c.active ? "Visible" : "Hidden"} />
                  {c.kind === "medicine" && <span className="badge ml-1 bg-emerald-100 text-emerald-800">💊 Medicine</span>}
                  {c.coverImage && <span className="badge ml-1 bg-blue-50 text-blue-700">Cover</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button className="btn-ghost btn-sm" onClick={() => move(c, -1)} disabled={idx === 0} aria-label={`Move ${c.name} earlier`} title="Move earlier">↑</button>
                <button className="btn-ghost btn-sm" onClick={() => move(c, 1)} disabled={idx === ordered.length - 1} aria-label={`Move ${c.name} later`} title="Move later">↓</button>
                <button className="btn-ghost btn-sm" onClick={() => open(c)} aria-label="Edit"><Icon name="edit" className="h-4 w-4" /></button>
                <button className="btn-ghost btn-sm text-red-600" onClick={() => del(c)} aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></button>
              </div>
              <div className="flex basis-full flex-wrap gap-x-5 gap-y-2 border-t pt-3">
                <Toggle checked={c.active} onChange={(v) => quick(c, { active: v })} label="Visible in store" />
                {c.kind !== "medicine" && <Toggle checked={!c.hideOnHome} onChange={(v) => quick(c, { hideOnHome: !v })} label="On home page" />}
              </div>
              <button type="button" onClick={() => open(c)} className="relative h-20 w-full basis-full overflow-hidden rounded-lg border border-dashed bg-gray-50 text-xs font-semibold text-gray-500 hover:border-primary hover:text-primary" aria-label={`Cover image for ${c.name}`}>
                {c.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <><img src={c.coverImage} alt="" className="h-full w-full object-cover" /><span className="absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">Change cover</span></>
                ) : "＋ Add cover image for this category"}
              </button>
            </div>
          ))}
        </div>
        </>
      )}
      <Modal
        open={!!edit}
        onClose={() => !busy && setEdit(null)}
        title={edit?.id ? "Edit category" : "Add category"}
        footer={
          <>
            <button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button>
          </>
        }
      >
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <ImageUpload kind="category" label="Circular icon image" hint="Shown as a circle on the storefront. Upload a square photo for best look." value={edit.f.image} onChange={(v) => set("image", v)} rounded="rounded-full" />
              <div className="space-y-4">
                <Field label="Name" error={errs.name}>
                  <input className="input" value={edit.f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Vegetables" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Emoji (legacy)" hint="Not shown on storefront. Letter initial is used if no image.">
                    <input className="input" value={edit.f.emoji} maxLength={8} onChange={(e) => set("emoji", e.target.value)} placeholder="optional" />
                  </Field>
                  <Field label="Sort order">
                    <input className="input" type="number" value={edit.f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>
            <ImageUpload kind="category" label="Cover / landing image (optional)" value={edit.f.coverImage} onChange={(v) => set("coverImage", v)} />
            <Field label="Page title (optional)" hint="Empty = the category name"><input className="input" value={edit.f.coverTitle || ""} maxLength={80} onChange={(e) => set("coverTitle", e.target.value)} /></Field>
            <Field label="Short description (shown on category page)">
              <input className="input" value={edit.f.description || ""} onChange={(e) => set("description", e.target.value)} maxLength={300} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cover height">
                <select className="input" value={edit.f.coverHeight || "md"} onChange={(e) => set("coverHeight", e.target.value)}>
                  <option value="sm">Small (compact)</option>
                  <option value="md">Medium (recommended)</option>
                  <option value="lg">Large</option>
                </select>
              </Field>
              <Field label="Image overlay">
                <select className="input" value={edit.f.coverOverlay || "medium"} onChange={(e) => set("coverOverlay", e.target.value)}>
                  <option value="dark">Dark</option>
                  <option value="medium">Medium</option>
                  <option value="light">Light</option>
                  <option value="none">None</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Image position"><select className="input" value={edit.f.coverPosition || "center"} onChange={(e) => set("coverPosition", e.target.value)}><option value="top">Show the top</option><option value="center">Centre</option><option value="bottom">Show the bottom</option></select></Field>
              <Field label="Title / text colour"><div className="flex items-center gap-2"><input type="color" className="h-10 w-12 rounded border bg-white p-1" value={edit.f.coverTextColor || "#111827"} onChange={(e) => set("coverTextColor", e.target.value)} />{edit.f.coverTextColor && <button type="button" className="btn-ghost btn-sm" onClick={() => set("coverTextColor", "")}>Reset</button>}</div></Field>
              <Field label="Banner background colour" hint="Shows when there is no image"><div className="flex items-center gap-2"><input type="color" className="h-10 w-12 rounded border bg-white p-1" value={edit.f.coverBg || "#1E3A8A"} onChange={(e) => set("coverBg", e.target.value)} />{edit.f.coverBg && <button type="button" className="btn-ghost btn-sm" onClick={() => set("coverBg", "")}>Reset</button>}</div></Field>
              <Field label="Home icon background"><div className="flex items-center gap-2"><input type="color" className="h-10 w-12 rounded border bg-white p-1" value={edit.f.iconBg || "#F3F4F6"} onChange={(e) => set("iconBg", e.target.value)} />{edit.f.iconBg && <button type="button" className="btn-ghost btn-sm" onClick={() => set("iconBg", "")}>Reset</button>}</div></Field>
            </div>
            <Field label="Section type" hint="Medicine categories appear in the Medicine section.">
              <select className="input" value={edit.f.kind} onChange={(e) => set("kind", e.target.value as Form["kind"])}>
                <option value="grocery">Grocery / general shop</option>
                <option value="medicine">💊 Medicine / healthcare</option>
              </select>
            </Field>
            <div className="flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={edit.f.active} onChange={(v) => set("active", v)} label="Visible in store" /><Toggle checked={!edit.f.hideOnHome} onChange={(v) => set("hideOnHome", !v)} label="Show icon on home page" /></div>
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}
