import { requireAdmin } from "@/server/auth";
import { handle, ok, readJson } from "@/server/http";
import { getCallingConfig } from "@/server/integrations/config";
import { requestCall } from "@/server/integrations/calling";
export const dynamic = "force-dynamic";
/** Placeholder endpoint for future activation. Answers 501 until a call provider is implemented, configured and enabled — it never pretends a call was placed. */
export const POST = handle(async (req) => {
  await requireAdmin(); const b = (await readJson(req)) ?? {};
  return ok(await requestCall(await getCallingConfig(), { to: String(b.to ?? ""), orderId: b.orderId ? String(b.orderId) : undefined }));
});
