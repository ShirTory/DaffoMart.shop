import { ApiError, clientIp, handle, ok, rateLimit, readJson } from "@/server/http";
import { evaluateCoupon } from "@/server/services";
import { z } from "zod";
export const dynamic = "force-dynamic";
const schema = z.object({ code: z.string().trim().min(1).max(24), subtotal: z.coerce.number().min(0) });
export const POST = handle(async (req) => {
  rateLimit(`coupon:${clientIp(req)}`, 30, 10 * 60_000);
  const { code, subtotal } = schema.parse(await readJson(req));
  const { offer, discount } = await evaluateCoupon(code, subtotal);
  return ok({ code: offer.code, title: offer.title, discount });
});
