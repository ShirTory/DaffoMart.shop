import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { applyWebhook, verifySignature } from "@/server/integrations/whatsapp";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";

/** Meta webhook verification handshake: GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams; const want = process.env.WHATSAPP_VERIFY_TOKEN || ""; const got = u.get("hub.verify_token") || "";
  const same = want.length > 0 && want.length === got.length && timingSafeEqual(Buffer.from(want), Buffer.from(got));
  if (u.get("hub.mode") === "subscribe" && same) return new Response(u.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}
/** Delivery receipts. The X-Hub-Signature-256 header is verified with WHATSAPP_APP_SECRET; unsigned or wrongly signed calls are rejected. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 1_000_000 || !verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) return new Response("Forbidden", { status: 403 });
  let body: unknown; try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  try { const n = await applyWebhook(body); return NextResponse.json({ ok: true, updated: n }); } catch (e) { console.error("[whatsapp] webhook failed", e); return NextResponse.json({ ok: false }, { status: 500 }); }
}
