import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { attendanceBulkSchema, attendanceUpsertSchema } from "@/lib/validators";
import type { Attendance, Employee } from "@/lib/types";
export const dynamic = "force-dynamic";

/** GET ?date=YYYY-MM-DD (one day) or ?month=YYYY-MM (whole month). Admin only. */
export const GET = handle(async (req) => {
  await requireAdmin();
  const u = new URL(req.url).searchParams; const date = u.get("date"), month = u.get("month");
  if (!date && !month) throw new ApiError(400, "Pass date=YYYY-MM-DD or month=YYYY-MM");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, "Invalid date");
  if (month && !/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, "Invalid month");
  const all = await db.list<Attendance>("attendance");
  return ok(all.filter((a) => (date ? a.date === date : a.date.startsWith(month!))));
});

const NO_TIME = ["absent", "leave", "off"];
/** PUT: set one employee's status (and optional check-in/out) for a day. */
export const PUT = handle(async (req) => {
  await requireAdmin();
  const d = attendanceUpsertSchema.parse(await readJson(req));
  if (!(await db.get<Employee>("employees", d.employeeId))) throw new ApiError(404, "Employee not found");
  const id = `${d.date}_${d.employeeId}`;
  const prev = await db.get<Attendance>("attendance", id);
  const noTime = NO_TIME.includes(d.status);
  const rec: Attendance = { id, employeeId: d.employeeId, date: d.date, status: d.status, checkIn: noTime ? undefined : d.checkIn ?? prev?.checkIn, checkOut: noTime ? undefined : d.checkOut ?? prev?.checkOut, note: d.note ?? prev?.note, updatedAt: new Date().toISOString() };
  return ok(await db.put("attendance", rec));
});

/** POST: mark many employees at once (default: everyone active without a record yet). */
export const POST = handle(async (req) => {
  await requireAdmin();
  const d = attendanceBulkSchema.parse(await readJson(req));
  const emps = (await db.list<Employee>("employees")).filter((e) => e.active && (!d.employeeIds || d.employeeIds.includes(e.id)));
  const existing = new Set((await db.list<Attendance>("attendance")).filter((a) => a.date === d.date).map((a) => a.employeeId));
  let marked = 0;
  for (const e of emps) {
    if (existing.has(e.id) && !d.overwrite) continue;
    await db.put("attendance", { id: `${d.date}_${e.id}`, employeeId: e.id, date: d.date, status: d.status, updatedAt: new Date().toISOString() } as Attendance); marked++;
  }
  return ok({ marked });
});
