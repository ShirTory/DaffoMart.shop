import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { handle, ok, readJson } from "@/server/http";
import { getSettings } from "@/server/services";
import { settingsPatchSchema } from "@/lib/validators";
export const dynamic = "force-dynamic";
export const GET = handle(async () => ok(await getSettings()));
/** Partial update: send only the fields you changed. */
export const PUT = handle(async (req) => {
  await requireAdmin();
  const data = settingsPatchSchema.parse(await readJson(req));
  const cur = (await db.get<Record<string, unknown> & { id: string }>("settings", "store")) ?? { id: "store" };
  await db.put("settings", { ...cur, ...data, id: "store" });
  return ok(await getSettings());
});
