import { requireAdmin } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { dashboardStats } from "@/server/services";
export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requireAdmin();
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 14, 7), 60);
  return ok(await dashboardStats(days));
});
