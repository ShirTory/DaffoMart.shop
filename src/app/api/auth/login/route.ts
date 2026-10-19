import { authenticateAdmin, createSessionCookie } from "@/server/auth";
import { ApiError, clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { loginSchema } from "@/lib/validators";
import { logAudit } from "@/server/audit";
export const dynamic = "force-dynamic";
export const POST = handle(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 8, 10 * 60_000);
  const { email, password } = loginSchema.parse(await readJson(req));
  rateLimit(`login-acct:${email.toLowerCase()}`, 10, 15 * 60_000);
  const session = await authenticateAdmin(email, password);
  if (!session) throw new ApiError(401, "Incorrect email or password");
  await createSessionCookie(session.email, { adminRole: session.adminRole, fullAccess: session.fullAccess });
  await logAudit({
    actor: session.email,
    actorRole: session.adminRole,
    action: "admin.login",
    detail: `fullAccess=${session.fullAccess}`,
    ip: clientIp(req),
  });
  return ok({ email: session.email, adminRole: session.adminRole, fullAccess: session.fullAccess });
});
