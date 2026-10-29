import { requireFullAdmin } from "@/server/auth";
import { listAudit } from "@/server/audit";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requireFullAdmin();
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  return ok(await listAudit(limit));
});
