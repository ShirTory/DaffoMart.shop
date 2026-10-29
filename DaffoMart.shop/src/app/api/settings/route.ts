import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { handle, ok, readJson } from "@/server/http";
import { getSettings } from "@/server/services";
import { settingsPatchSchema } from "@/lib/validators";
export const dynamic = "force-dynamic";
export const GET = handle(async () => ok(await getSettings()));
const NEVER_CLEAR = new Set(["id", "storeName"]);
/** Partial update: send only the fields you changed. A field sent as `null` is cleared (back to its default), e.g. the "Reset" button on a colour. */
export const PUT = handle(async (req) => {
  await requireAdmin();
  const raw = (await readJson(req)) as Record<string, unknown>;
  const clear = Object.keys(raw ?? {}).filter((k) => raw[k] === null && !NEVER_CLEAR.has(k));
  const data = settingsPatchSchema.parse(Object.fromEntries(Object.entries(raw ?? {}).filter(([, v]) => v !== null)));
  const cur = (await db.get<Record<string, unknown> & { id: string }>("settings", "store")) ?? { id: "store" };
  const next: Record<string, unknown> & { id: string } = { ...cur, ...data, id: "store" };
  for (const k of clear) delete next[k];
  await db.put("settings", next);
  return ok(await getSettings());
});
