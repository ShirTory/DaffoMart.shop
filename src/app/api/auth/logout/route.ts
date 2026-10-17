import { clearSessionCookie } from "@/server/auth";
import { handle, ok } from "@/server/http";
export const POST = handle(async () => { await clearSessionCookie(); return ok({}); });
