import { requireAdmin } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { listAdmin } from "@/server/reviews";
export const dynamic = "force-dynamic";
export const GET = handle(async (req) => { await requireAdmin(); return ok(await listAdmin(new URL(req.url).searchParams.get("status") || undefined)); });
