import { clearRiderSession, getRider } from "@/server/riderAuth";
import { db } from "@/server/db";
import { handle, ok } from "@/server/http";
import type { Rider } from "@/lib/types";
/** Signing out also stops sharing the rider's live position. */
export const POST = handle(async () => {
  const r = await getRider();
  if (r?.locAt) await db.update<Rider>("riders", r.id, { lat: undefined, lng: undefined, locAt: undefined });
  await clearRiderSession(); return ok({});
});
