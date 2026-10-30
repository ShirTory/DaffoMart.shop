import { requireAdmin } from "@/server/auth";
import { listSeo } from "@/server/seo";
import { handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = handle(async () => { await requireAdmin(); return ok(await listSeo()); });
