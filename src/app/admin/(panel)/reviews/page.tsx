"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Empty, ErrorBox, PageHeader, PageLoader, useConfirm, useList, useToast } from "@/components/admin/ui";
import { Stars } from "@/components/product/Reviews";
import type { ProductReview, ReviewStatus } from "@/lib/types";

type Row = Omit<ProductReview, "orderId"> & { productName: string };
const TABS: { k: ReviewStatus | ""; label: string }[] = [{ k: "pending", label: "Waiting" }, { k: "approved", label: "Approved" }, { k: "hidden", label: "Hidden" }, { k: "rejected", label: "Rejected" }, { k: "", label: "All" }];
const BADGE: Record<ReviewStatus, string> = { pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-700", hidden: "bg-gray-200 text-gray-700", rejected: "bg-red-100 text-red-700" };

export default function ReviewsPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const [tab, setTab] = useState<ReviewStatus | "">("pending");
  const { data, loading, error, reload } = useList<Row[]>(`/api/admin/reviews${tab ? `?status=${tab}` : ""}`);
  const [busy, setBusy] = useState("");
  const set = async (r: Row, status: ReviewStatus) => { setBusy(r.id); try { await api(`/api/admin/reviews/${r.id}`, { method: "PATCH", body: { status } }); toast(status === "approved" ? "Approved: it is now on the product page" : `Marked ${status}`); reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(""); } };
  const del = async (r: Row) => { if (!(await confirm("Delete this review permanently?"))) return; setBusy(r.id); try { await api(`/api/admin/reviews/${r.id}`, { method: "DELETE" }); toast("Deleted"); reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(""); } };
  return (
    <>
      <PageHeader title="Customer Reviews" subtitle="Reviews only come from customers with a delivered order for the product. Approve to publish; hide or reject to keep one off the page." />
      <div className="mb-4 inline-flex flex-wrap overflow-hidden rounded-xl border bg-white" role="tablist">{TABS.map((t) => <button key={t.label} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)} className={`px-4 py-2 text-sm font-semibold ${tab === t.k ? "bg-primary text-white" : "hover:bg-gray-50"}`}>{t.label}</button>)}</div>
      {loading ? <PageLoader /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.length ? <Empty icon="alert" title="No reviews here" hint="New customer reviews wait here for your approval." /> : (
        <ul className="space-y-3">{data.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Stars value={r.rating} /><span className="font-semibold">{r.name}</span><span className={`badge ${BADGE[r.status]}`}>{r.status}</span><span className="text-xs text-gray-500">{r.productName} · {new Date(r.createdAt).toLocaleString()} · phone {r.phone}</span></div>
            {r.title && <p className="mt-2 font-semibold">{r.title}</p>}<p className="mt-1 whitespace-pre-line text-sm text-gray-700">{r.text}</p>
            {r.images.length > 0 && <div className="mt-2 flex gap-2">{r.images.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="Review photo" className="h-full w-full object-cover" /></a>)}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status !== "approved" && <button className="btn-primary btn-sm" disabled={busy === r.id} onClick={() => set(r, "approved")}>Approve</button>}
              {r.status === "approved" && <button className="btn-outline btn-sm" disabled={busy === r.id} onClick={() => set(r, "hidden")}>Hide</button>}
              {r.status !== "rejected" && <button className="btn-outline btn-sm" disabled={busy === r.id} onClick={() => set(r, "rejected")}>Reject</button>}
              <button className="btn-ghost btn-sm text-red-600" disabled={busy === r.id} onClick={() => del(r)}>Delete</button>
            </div>
          </li>))}</ul>)}
      {node}
    </>
  );
}
