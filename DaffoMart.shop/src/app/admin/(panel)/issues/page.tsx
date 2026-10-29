"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Empty, ErrorBox, Field, Modal, PageHeader, PageLoader, Spinner, StatusBadge, useToast } from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import type { OrderIssue } from "@/lib/types";

export default function IssuesPage() {
  const toast = useToast();
  const [list, setList] = useState<OrderIssue[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<OrderIssue | null>(null);
  const [status, setStatus] = useState<OrderIssue["status"]>("open");
  const [adminNote, setAdminNote] = useState("");

  const load = () => {
    setErr("");
    api<OrderIssue[]>("/api/issues").then(setList).catch((e: any) => setErr(e.message));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const next = await api<OrderIssue>(`/api/issues/${edit.id}`, { method: "PATCH", body: { status, adminNote } });
      setList((d) => d!.map((x) => (x.id === next.id ? next : x)));
      toast("Issue updated");
      setEdit(null);
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Order issues" subtitle="Reports from customers and riders" />
      {err ? <ErrorBox msg={err} retry={load} /> : !list ? <PageLoader /> : !list.length ? (
        <Empty icon="orders" title="No issues yet" hint="When a customer or rider reports a problem on an order it appears here." />
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50"><tr>
                <th className="th">Order</th><th className="th">By</th><th className="th">Issue</th><th className="th">Status</th><th className="th">When</th><th className="th" />
              </tr></thead>
              <tbody className="divide-y">
                {list.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="td font-mono text-sm">{i.orderNo}</td>
                    <td className="td text-sm capitalize">{i.raisedBy}<br /><span className="text-xs text-gray-500">{i.raiserName || i.raiserPhone}</span></td>
                    <td className="td max-w-xs truncate text-sm">{i.text}</td>
                    <td className="td"><StatusBadge status={i.status === "resolved" || i.status === "closed" ? "active" : "pending"} label={i.status} /></td>
                    <td className="td text-xs text-gray-500">{fmtDateTime(i.createdAt)}</td>
                    <td className="td text-right">
                      <button className="btn-ghost btn-sm" onClick={() => { setEdit(i); setStatus(i.status); setAdminNote(i.adminNote || ""); }}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit ? `Issue · ${edit.orderNo}` : "Issue"}
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Close</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {edit && (
          <div className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{edit.text}</p>
            {edit.photos?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {edit.photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-gray-200" /></a>
                ))}
              </div>
            )}
            {edit.video && <a href={edit.video} target="_blank" rel="noopener noreferrer" className="text-sm text-primary">Open video</a>}
            <Field label="Status">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderIssue["status"])}>
                {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Admin note"><textarea className="input" rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} /></Field>
            <p className="text-xs text-gray-400">Raised {fmtDateTime(edit.createdAt)} · {edit.raisedBy}</p>
          </div>
        )}
      </Modal>
    </>
  );
}
