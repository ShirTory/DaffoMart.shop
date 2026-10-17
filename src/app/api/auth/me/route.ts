import { getAdmin } from "@/server/auth";
import { ApiError, handle, ok } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = handle(async () => { const a = await getAdmin(); if (!a) throw new ApiError(401, "Not signed in"); return ok(a); });
