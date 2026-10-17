import { db } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { createEmployeeSession, publicEmployee, verifyPassword } from "@/server/riderAuth";
import { employeeLoginSchema } from "@/lib/validators";
import type { Employee } from "@/lib/types";
export const dynamic = "force-dynamic";
const DUMMY_HASH = "00000000000000000000000000000000:" + "0".repeat(64);
export const POST = handle(async (req) => {
  rateLimit(`emp-login:${clientIp(req)}`, 10, 10 * 60_000);
  const { phone, password } = employeeLoginSchema.parse(await readJson(req));
  const e = (await db.list<Employee>("employees")).find((x) => x.phone === phone.replace(/\s|-/g, ""));
  const good = verifyPassword(password, e?.passHash ?? DUMMY_HASH);
  if (!e || !good) throw new ApiError(401, "Wrong phone number or password");
  if (e.status === "pending") throw new ApiError(403, "Your application is under review.");
  if (e.status === "rejected") throw new ApiError(403, `Your application was not approved.${e.rejectReason ? ` Reason: ${e.rejectReason}` : ""}`);
  if (!e.active) throw new ApiError(403, "Your account is inactive. Contact the store.");
  await createEmployeeSession(e.id);
  return ok(publicEmployee(e));
});
