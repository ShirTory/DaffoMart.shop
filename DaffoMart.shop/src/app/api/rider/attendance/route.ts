import { db, newId } from "@/server/db";
import { requireRider } from "@/server/riderAuth";
import { ApiError, handle, ok, readJson } from "@/server/http";
import { dhakaDate, dhakaTime } from "@/lib/dates";
import type { Attendance, Employee } from "@/lib/types";
export const dynamic = "force-dynamic";

async function employeeFor(r: { id: string; name: string; phone: string }) {
  const all = await db.list<Employee>("employees");
  const found = all.find((e) => e.riderId === r.id) ?? all.find((e) => e.role === "Rider" && e.phone && e.phone === r.phone);
  if (found) return found;
  return db.put<Employee>("employees", { id: newId(), name: r.name, role: "Rider", phone: r.phone, email: "", note: "Added automatically from the rider app", active: true, riderId: r.id, createdAt: new Date().toISOString() });
}
const today = (employeeId: string) => db.get<Attendance>("attendance", `${dhakaDate()}_${employeeId}`);

export const GET = handle(async () => {
  const r = await requireRider(); const all = await db.list<Employee>("employees");
  const e = all.find((x) => x.riderId === r.id) ?? all.find((x) => x.role === "Rider" && x.phone && x.phone === r.phone);
  return ok({ today: e ? await today(e.id) : null });
});

/** POST {action:"in"|"out"} – the rider records their own attendance (time is taken from the server). */
export const POST = handle(async (req) => {
  const r = await requireRider(); const b = (await readJson(req)) as { action?: string };
  if (b.action !== "in" && b.action !== "out") throw new ApiError(400, "Invalid action");
  const e = await employeeFor(r); if (!e.active) throw new ApiError(403, "Your staff profile is inactive. Contact the office.");
  const prev = await today(e.id); const t = dhakaTime();
  if (b.action === "in") {
    if (prev?.checkIn) throw new ApiError(409, `Already checked in at ${prev.checkIn}`);
    return ok(await db.put<Attendance>("attendance", { id: `${dhakaDate()}_${e.id}`, employeeId: e.id, date: dhakaDate(), status: t > "10:15" ? "late" : "present", checkIn: t, updatedAt: new Date().toISOString() })); // 15 min grace after 10:00
  }
  if (!prev?.checkIn) throw new ApiError(409, "Check in first");
  if (prev.checkOut) throw new ApiError(409, `Already checked out at ${prev.checkOut}`);
  return ok(await db.put<Attendance>("attendance", { ...prev, checkOut: t, updatedAt: new Date().toISOString() }));
});
