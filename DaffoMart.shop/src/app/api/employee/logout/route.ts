import { handle, ok } from "@/server/http";
import { clearEmployeeSession } from "@/server/riderAuth";
export const dynamic = "force-dynamic";
export const POST = handle(async () => { await clearEmployeeSession(); return ok({ ok: true }); });
