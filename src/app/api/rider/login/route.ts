import { db } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { createRiderSession, publicRider, verifyPassword } from "@/server/riderAuth";
import { riderLoginSchema } from "@/lib/validators";
import type { Rider } from "@/lib/types";
export const dynamic = "force-dynamic";
const DUMMY_HASH = "00000000000000000000000000000000:" + "0".repeat(64);
export const POST = handle(async (req) => {
  rateLimit(`rider-login:${clientIp(req)}`, 10, 10 * 60_000);
  const { phone, password } = riderLoginSchema.parse(await readJson(req));
  const r = (await db.list<Rider>("riders")).find((x) => x.phone === phone.replace(/\s|-/g, ""));
  const good = verifyPassword(password, r?.passHash ?? DUMMY_HASH); // always hash-compare to keep timing similar
  if (!r || !good) throw new ApiError(401, "Wrong phone number or password");
  if (r.status === "pending") throw new ApiError(403, "Your application is under review. The store will approve it after checking your information.");
  if (r.status === "rejected") throw new ApiError(403, `Your application was not approved.${r.rejectReason ? ` Reason: ${r.rejectReason}` : ""}`);
  if (!r.active) throw new ApiError(403, "Your rider account is inactive. Contact the store.");
  await createRiderSession(r.id);
  return ok(publicRider(r));
});
