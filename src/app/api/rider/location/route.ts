import { db } from "@/server/db";
import { handle, ok, rateLimit, readJson } from "@/server/http";
import { requireRider } from "@/server/riderAuth";
import { riderLocationSchema } from "@/lib/validators";
import type { Rider } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Rider app → live GPS ping (every few seconds while "Share live location" is on). { lat, lng } saves it, { stop: true } clears it. */
export const POST = handle(async (req) => {
  const rider = await requireRider();
  rateLimit(`loc:${rider.id}`, 40, 60_000);
  const body = riderLocationSchema.parse(await readJson(req));
  if ("stop" in body) await db.update<Rider>("riders", rider.id, { lat: undefined, lng: undefined, locAt: undefined });
  else await db.update<Rider>("riders", rider.id, { lat: +body.lat.toFixed(6), lng: +body.lng.toFixed(6), locAt: new Date().toISOString() });
  return ok({ saved: true });
});
