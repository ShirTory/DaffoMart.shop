import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { handle, ok } from "@/server/http";
import type { Rider } from "@/lib/types";
export const dynamic = "force-dynamic";
export const GET = handle(async () => { await requireAdmin(); return ok({ count: (await db.list<Rider>("riders")).filter((r) => r.status === "pending").length }); });
