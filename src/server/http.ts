import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export const ok = <T,>(data: T, status = 200) => NextResponse.json({ ok: true, data }, { status });

type Ctx = { params: Promise<Record<string, string>> };
export function handle(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try { return await fn(req, ctx); }
    catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ ok: false, error: e.message, details: e.details }, { status: e.status });
      if (e instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const i of e.issues) fields[i.path.join(".") || "_"] ??= i.message;
        return NextResponse.json({ ok: false, error: e.issues[0]?.message ?? "Invalid data", details: fields }, { status: 400 });
      }
      console.error("[api]", req.method, req.url, e);
      return NextResponse.json({ ok: false, error: "Something went wrong on the server" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request) {
  try { return await req.json(); } catch { throw new ApiError(400, "Request body must be valid JSON"); }
}

// Small in-memory rate limiter (per server instance). Good enough for login/order abuse protection.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k); return; }
  if (++h.n > max) throw new ApiError(429, "Too many requests. Please try again in a few minutes.");
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
