import { db } from "@/server/db";
import { requireAdmin, requireOwner } from "@/server/auth";
import { clientIp, handle, ok, readJson, ApiError } from "@/server/http";
import { logAudit } from "@/server/audit";
import { getCallingConfig, getWhatsAppConfig, parseCallingConfig, parseWhatsAppConfig, saveIntegration, waEnvStatus, WA_TOKENS } from "@/server/integrations/config";
import { CALL_PROVIDERS, callingStatus } from "@/server/integrations/calling";
import { SITE_URL } from "@/lib/site";
import type { MessageLog } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Settings + secret presence (booleans only) + recent message log. */
export const GET = handle(async () => {
  await requireAdmin();
  const [wa, calling, logs] = await Promise.all([getWhatsAppConfig(), getCallingConfig(), db.list<MessageLog>("message_logs")]);
  return ok({
    whatsapp: wa, env: waEnvStatus(), tokens: WA_TOKENS, webhookUrl: `${SITE_URL}/api/whatsapp/webhook`,
    calling, callingStatus: callingStatus(calling), providers: CALL_PROVIDERS.map((p) => ({ id: p.id, label: p.label, implemented: p.implemented, envVars: p.envVars })),
    logs: logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60),
  });
});
/** PUT { whatsapp?: {...}, calling?: {...} } — Owner only (it decides who receives order data and which provider is used). */
export const PUT = handle(async (req) => {
  const a = await requireOwner(); const body = (await readJson(req)) ?? {}; const changed: string[] = [];
  if (body.whatsapp) { await saveIntegration(parseWhatsAppConfig(body.whatsapp, await getWhatsAppConfig()), a.email); changed.push("whatsapp"); }
  if (body.calling) { await saveIntegration(parseCallingConfig(body.calling, await getCallingConfig()), a.email); changed.push("calling"); }
  if (!changed.length) throw new ApiError(400, "Nothing to save");
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "integrations.update", detail: changed.join(","), ip: clientIp(req) });
  return ok({ saved: changed });
});
