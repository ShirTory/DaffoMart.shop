import { requireFinance } from "@/server/auth";
import { financeOverview } from "@/server/finance";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  await requireFinance();
  return ok(await financeOverview());
});
