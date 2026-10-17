import { checkCredentials, createSessionCookie } from "@/server/auth";
import { ApiError, clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { loginSchema } from "@/lib/validators";
export const dynamic = "force-dynamic";
export const POST = handle(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 8, 10 * 60_000);
  const { email, password } = loginSchema.parse(await readJson(req));
  if (!checkCredentials(email, password)) throw new ApiError(401, "Incorrect email or password");
  await createSessionCookie(email);
  return ok({ email });
});
