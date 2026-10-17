"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Empty, ErrorBox, PageHeader, PageLoader, Spinner, useList, useToast } from "@/components/admin/ui";
import { dhakaDate, dhakaMonth, daysInMonth } from "@/lib/dates";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, type Attendance, type AttendanceStatus, type Employee } from "@/lib/types";

const COLOR: Record<AttendanceStatus, string> = { present: "bg-emerald-100 text-emerald-800", late: "bg-amber-100 text-amber-800", half: "bg-sky-100 text-sky-800", leave: "bg-violet-100 text-violet-800", absent: "bg-red-100 text-red-700", off: "bg-gray-100 text-gray-600" };
const LETTER: Record<AttendanceStatus, string> = { present: "P", late: "L", half: "H", leave: "V", absent: "A", off: "O" };

export default function AttendancePage() {
  const toast = useToast();
  const emps = useList<Employee[]>("/api/employees");
  const [tab, setTab] = useState<"day" | "month">("day");
  const [date, setDate] = useState(dhakaDate()); const [month, setMonth] = useState(dhakaMonth());
  const [recs, setRecs] = useState<Attendance[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const active = useMemo(() => (emps.data ?? []).filter((e) => e.active), [emps.data]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setRecs(await api<Attendance[]>(tab === "day" ? `/api/attendance?date=${date}` : `/api/attendance?month=${month}`)); } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [tab, date, month]);
  useEffect(() => { load(); }, [load]);

  const byEmp = useMemo(() => new Map(recs.filter((r) => r.date === date).map((r) => [r.employeeId, r])), [recs, date]);
  const put = async (employeeId: string, patch: Partial<Attendance> & { status: AttendanceStatus }) => {
    const cur = byEmp.get(employeeId);
    try {
      const r = await api<Attendance>("/api/attendance", { method: "PUT", body: { employeeId, date, status: patch.status, checkIn: patch.checkIn ?? cur?.checkIn ?? "", checkOut: patch.checkOut ?? cur?.checkOut ?? "", note: patch.note ?? cur?.note ?? "" } });
      setRecs((l) => [...l.filter((x) => x.id !== r.id), r]);
    } catch (e: any) { toast(e.message, "err"); }
  };
  const markAll = async (status: AttendanceStatus) => { setBusy(true); try { const r = await api<{ marked: number }>("/api/attendance", { method: "POST", body: { date, status } }); toast(r.marked ? `${r.marked} marked ${ATTENDANCE_LABEL[status].toLowerCase()}` : "Everyone already has a record"); await load(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };

  const summary = useMemo(() => {
    const days = daysInMonth(month);
    return active.map((e) => {
      const mine = recs.filter((r) => r.employeeId === e.id); const c = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, mine.filter((r) => r.status === s).length])) as Record<AttendanceStatus, number>;
      const worked = c.present + c.late + c.half * 0.5; const marked = mine.length - c.off - c.leave;
      return { e, c, days, worked, pct: marked > 0 ? Math.round((worked / marked) * 100) : null, map: new Map(mine.map((r) => [r.date, r.status])) };
    });
  }, [active, recs, month]);
  const csv = () => {
    const head = ["Name", "Role", ...ATTENDANCE_STATUSES.map((s) => ATTENDANCE_LABEL[s]), "Attendance %"];
    const rows = summary.map((s) => [s.e.name, s.e.role, ...ATTENDANCE_STATUSES.map((x) => s.c[x]), s.pct ?? ""]);
    const text = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = `attendance-${month}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const counts = ATTENDANCE_STATUSES.map((s) => [s, active.filter((e) => byEmp.get(e.id)?.status === s).length] as const);
  const notMarked = active.filter((e) => !byEmp.has(e.id)).length;

  if (emps.loading) return <PageLoader />; if (emps.error) return <ErrorBox msg={emps.error} retry={emps.reload} />;
  return (
    <>
      <PageHeader title="Attendance" subtitle="Daily attendance for all staff, CEO to rider (Bangladesh time)">
        <div className="flex rounded-lg border bg-white p-0.5">{(["day", "month"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-primary text-white" : "text-gray-600"}`}>{t === "day" ? "Daily" : "Monthly report"}</button>)}</div>
      </PageHeader>
      {!active.length ? <Empty icon="rider" title="No active staff" hint="Add your team first." action={<a href="/admin/employees" className="btn-primary">Add staff</a>} /> : tab === "day" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input type="date" className="input w-auto" value={date} max={dhakaDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button className="btn-outline btn-sm" onClick={() => setDate(dhakaDate())}>Today</button>
            <button className="btn-primary btn-sm" onClick={() => markAll("present")} disabled={busy || !notMarked}>{busy && <Spinner className="h-3.5 w-3.5" />}Mark unmarked ({notMarked}) present</button>
            <div className="ml-auto flex flex-wrap gap-1.5 text-xs">{counts.filter(([, n]) => n).map(([s, n]) => <span key={s} className={`badge ${COLOR[s]}`}>{ATTENDANCE_LABEL[s]} {n}</span>)}{notMarked > 0 && <span className="badge bg-gray-100 text-gray-600">Not marked {notMarked}</span>}</div>
          </div>
          <div className="card overflow-hidden">{loading ? <PageLoader /> : err ? <div className="p-4"><ErrorBox msg={err} retry={load} /></div> : (
            <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[760px]"><thead className="bg-gray-50"><tr><th className="th">Employee</th><th className="th">Status</th><th className="th">Check-in</th><th className="th">Check-out</th><th className="th">Note</th></tr></thead>
              <tbody className="divide-y">{active.map((e) => { const r = byEmp.get(e.id); const noTime = r && ["absent", "leave", "off"].includes(r.status);
                return (<tr key={e.id}><td className="td"><p className="font-medium">{e.name}</p><p className="text-xs text-gray-500">{e.role}</p></td>
                  <td className="td"><div className="flex flex-wrap gap-1">{ATTENDANCE_STATUSES.map((s) => <button key={s} type="button" onClick={() => put(e.id, { status: s })} className={`rounded-md px-2 py-1 text-xs font-semibold transition ${r?.status === s ? COLOR[s] + " ring-2 ring-current" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>{ATTENDANCE_LABEL[s]}</button>)}</div></td>
                  <td className="td"><input type="time" className="input w-28 py-1" disabled={!r || !!noTime} value={r?.checkIn ?? ""} onChange={(x) => r && put(e.id, { status: r.status, checkIn: x.target.value })} /></td>
                  <td className="td"><input type="time" className="input w-28 py-1" disabled={!r || !!noTime} value={r?.checkOut ?? ""} onChange={(x) => r && put(e.id, { status: r.status, checkOut: x.target.value })} /></td>
                  <td className="td"><input className="input py-1" disabled={!r} defaultValue={r?.note ?? ""} key={`${e.id}${date}${r?.updatedAt ?? ""}`} placeholder={r ? "Optional note" : "Mark status first"} onBlur={(x) => r && x.target.value !== (r.note ?? "") && put(e.id, { status: r.status, note: x.target.value })} /></td></tr>); })}</tbody></table></div>)}</div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3"><input type="month" className="input w-auto" value={month} max={dhakaMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} /><button className="btn-outline btn-sm" onClick={csv} disabled={!summary.length}>⬇ Download CSV</button>
            <div className="ml-auto flex flex-wrap gap-1.5 text-xs">{ATTENDANCE_STATUSES.map((s) => <span key={s} className={`badge ${COLOR[s]}`}>{LETTER[s]} = {ATTENDANCE_LABEL[s]}</span>)}</div></div>
          <div className="card overflow-hidden">{loading ? <PageLoader /> : err ? <div className="p-4"><ErrorBox msg={err} retry={load} /></div> : (
            <div className="scroll-thin overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="th sticky left-0 bg-gray-50">Employee</th>{ATTENDANCE_STATUSES.map((s) => <th key={s} className="th text-center">{LETTER[s]}</th>)}<th className="th text-center">%</th>{Array.from({ length: daysInMonth(month) }, (_, i) => <th key={i} className="px-1 py-3 text-center text-[10px] font-semibold text-gray-400">{i + 1}</th>)}</tr></thead>
              <tbody className="divide-y">{summary.map((s) => (<tr key={s.e.id}><td className="td sticky left-0 whitespace-nowrap bg-white"><p className="font-medium">{s.e.name}</p><p className="text-xs text-gray-500">{s.e.role}</p></td>{ATTENDANCE_STATUSES.map((x) => <td key={x} className="td text-center">{s.c[x] || <span className="text-gray-300">0</span>}</td>)}<td className="td text-center font-semibold">{s.pct === null ? "—" : `${s.pct}%`}</td>
                {Array.from({ length: s.days }, (_, i) => { const d = `${month}-${String(i + 1).padStart(2, "0")}`; const st = s.map.get(d); return <td key={d} className="px-0.5 py-2 text-center">{st ? <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${COLOR[st]}`} title={`${d}: ${ATTENDANCE_LABEL[st]}`}>{LETTER[st]}</span> : <span className="text-gray-200">·</span>}</td>; })}</tr>))}</tbody></table></div>)}</div>
          <p className="mt-3 text-xs text-gray-400">Attendance % = (present + late + ½ half-days) ÷ marked working days. Leave and day-off are not counted against anyone.</p>
        </>
      )}
    </>
  );
}
