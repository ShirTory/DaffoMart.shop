import { requireAdmin } from "@/server/auth";
import { ApiError, handle, ok, rateLimit } from "@/server/http";
import { retryMessage } from "@/server/integrations/whatsapp";
export const dynamic = "force-dynamic";
export const POST = handle(async (_r, ctx) => {
  const a = await requireAdmin(); rateLimit(`wa-retry:${a.email}`, 30, 10 * 60_000);
  const l = await retryMessage((await ctx.params).id); if (!l) throw new ApiError(404, "Message not found");
  return ok(l);
});
