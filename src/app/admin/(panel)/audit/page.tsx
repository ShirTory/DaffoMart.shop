"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, PageHeader, PageLoader } from "@/components/admin/ui";

type Log = { id: string; at: string; actor: string; actorRole: string; action: string; target?: string; detail?: string; ip?: string };

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [err, setErr] = useState("");
  const load = async () => {
    try { setLogs(await api<Log[]>("/api/admin/audit?limit=200")); setErr(""); }
    catch (e: any) { setErr(e.message); setLogs([]); }
  };
  useEffect(() => { load(); }, []);
  if (logs === null && !err) return <PageLoader />;
  return (
    <>
      <PageHeader title="Audit logs" subtitle="Sensitive admin actions (login, role grants, SKU backfill). Append-only." />
      {err && <ErrorBox msg={err} retry={load} />}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50"><tr><th className="th">When</th><th className="th">Actor</th><th className="th">Role</th><th className="th">Action</th><th className="th">Target</th><th className="th">Detail</th></tr></thead>
          <tbody className="divide-y">
            {(logs || []).length === 0 && <tr><td colSpan={6} className="td text-gray-500">No audit entries yet.</td></tr>}
            {(logs || []).map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap text-xs text-gray-500">{new Date(l.at).toLocaleString()}</td>
                <td className="td font-medium">{l.actor}</td>
                <td className="td">{l.actorRole}</td>
                <td className="td font-mono text-xs">{l.action}</td>
                <td className="td text-xs">{l.target || "—"}</td>
                <td className="td max-w-xs truncate text-xs text-gray-600">{l.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
