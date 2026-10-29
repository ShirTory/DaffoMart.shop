import { requireOwner } from "@/server/auth";
import { clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { logAudit } from "@/server/audit";
import { sendTest } from "@/server/integrations/whatsapp";
export const dynamic = "force-dynamic";
/** Sends ONE real test message through the configured WhatsApp API. The answer says exactly what the API returned. */
export const POST = handle(async (req) => {
  const a = await requireOwner(); rateLimit(`wa-test:${a.email}`, 10, 10 * 60_000);
  const { to } = (await readJson(req)) ?? {}; const r = await sendTest(String(to ?? ""));
  await logAudit({ actor: a.email, actorRole: a.adminRole, action: "whatsapp.test", detail: r.status, ip: clientIp(req) });
  return ok(r);
});
