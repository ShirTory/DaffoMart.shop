/**
 * WhatsApp Business messaging through the official WhatsApp Business Platform (Meta Cloud API).
 *
 * Honesty rules, enforced here:
 *  - A message is logged "accepted" ONLY when the API answered 2xx AND returned a message id. Real delivery
 *    ("sent" / "delivered" / "read" / "failed") is recorded only when Meta's webhook reports it.
 *  - Not configured / disabled / invalid number  -> logged "skipped" with the reason. Network or API error -> "failed" with the error.
 *  - An order is NEVER blocked or rolled back because a message failed.
 *  - One log document per (message kind, order, recipient): a retried checkout cannot send the same message twice.
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { db } from "../db";
import { SITE_URL } from "@/lib/site";
import { taka } from "@/lib/format";
import { waNumber } from "@/lib/phone";
import { getWhatsAppConfig } from "./config";
import type { MessageLog, MessageStatus, Order, WaTemplateKind, WhatsAppConfig } from "@/lib/types";

const SEND_TIMEOUT_MS = 8000;
const now = () => new Date().toISOString();

/* ---------- message building (pure) ---------- */
export interface MsgCtx { storeName: string; siteUrl: string }
export function tokenValues(o: Order, ctx: MsgCtx): Record<string, string> {
  return {
    storeName: ctx.storeName, orderNo: o.orderNo, customerName: o.name, customerPhone: o.phone, total: taka(o.total), subtotal: taka(o.subtotal), delivery: o.delivery ? taka(o.delivery) : "Free",
    status: o.status.replace(/_/g, " "), address: o.address, area: o.zoneName || "", payment: o.paymentLabel || o.payment,
    items: o.items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 300), trackUrl: `${ctx.siteUrl}/track?no=${encodeURIComponent(o.orderNo)}&phone=${encodeURIComponent(o.phone)}`,
  };
}
export const renderText = (tpl: string, v: Record<string, string>) => tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => v[k] ?? "").trim();
// WhatsApp rejects template parameters that contain newlines, tabs or 4+ consecutive spaces.
const oneLine = (s: string) => (s || "-").replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 1000) || "-";

export function buildPayload(kind: WaTemplateKind, to: string, o: Order, cfg: WhatsAppConfig, ctx: MsgCtx) {
  const v = tokenValues(o, ctx);
  if (cfg.messageMode === "text") return { messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body: renderText(cfg.textTemplates[kind], v).slice(0, 4000) } };
  const t = cfg.templates[kind];
  return { messaging_product: "whatsapp", to, type: "template", template: { name: t.name, language: { code: t.language }, ...(t.params.length ? { components: [{ type: "body", parameters: t.params.map((p) => ({ type: "text", text: oneLine(v[p] ?? "") })) }] } : {}) } };
}

/* ---------- HTTP ---------- */
export type SendResult = { ok: true; messageId: string; httpStatus: number } | { ok: false; error: string; httpStatus?: number };
export async function sendRaw(cfg: WhatsAppConfig, payload: unknown): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN is not set on the server" };
  try {
    const res = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const json: any = await res.json().catch(() => null);
    const id = json?.messages?.[0]?.id;
    if (res.ok && typeof id === "string" && id) return { ok: true, messageId: id, httpStatus: res.status };
    const e = json?.error; const msg = e ? `${e.message ?? "Request rejected"}${e.code ? ` (code ${e.code}${e.error_subcode ? "/" + e.error_subcode : ""})` : ""}` : res.ok ? "The API answered without a message id, so delivery cannot be confirmed" : `HTTP ${res.status}`;
    return { ok: false, error: String(msg).slice(0, 400), httpStatus: res.status };
  } catch (e: any) {
    return { ok: false, error: (e?.name === "TimeoutError" || e?.name === "AbortError" ? `No answer from WhatsApp within ${SEND_TIMEOUT_MS / 1000}s` : `Network error: ${e?.message ?? e}`).slice(0, 400) };
  }
}

/* ---------- logging + delivery ---------- */
const logId = (kind: string, orderId: string, to: string, extra = "") => "wa_" + createHash("sha256").update([kind, orderId, to, extra].join("|")).digest("hex").slice(0, 20);
async function finish(id: string, patch: Partial<MessageLog>) { return db.update<MessageLog>("message_logs", id, { ...patch, updatedAt: now() }); }

export interface DeliverInput { kind: WaTemplateKind; order: Order; to: string; /** distinguishes repeated sends of the same kind (e.g. each status) */ variant?: string; /** admin "retry": re-send even if a log already exists */ force?: boolean; /** retry: reuse this exact log document */ logId?: string }
export async function deliver(input: DeliverInput, cfg?: WhatsAppConfig): Promise<MessageLog> {
  cfg ??= await getWhatsAppConfig(); const { kind, order } = input;
  const to = waNumber(input.to, cfg.defaultCountryCode) ?? "";
  const id = input.logId ?? logId(kind, order.id, to || input.to, input.variant);
  const base: MessageLog = { id, channel: "whatsapp", kind, orderId: order.id, orderNo: order.orderNo, to: to || input.to, status: "queued", createdAt: now(), updatedAt: now() };
  const skip = async (reason: string) => { const l = { ...base, status: "skipped" as MessageStatus, reason }; await db.put("message_logs", l); return l; };

  const prior = await db.get<MessageLog>("message_logs", id);
  if (prior && !input.force) return prior; // already handled: never send twice
  if (!cfg.enabled) return skip("WhatsApp automation is turned off");
  if (!cfg.phoneNumberId) return skip("Phone Number ID is not set");
  if (!process.env.WHATSAPP_ACCESS_TOKEN) return skip("WHATSAPP_ACCESS_TOKEN is not set on the server");
  if (!to) return skip("The recipient is not a valid WhatsApp number");
  if (cfg.messageMode === "template" && !cfg.templates[kind].name) return skip("No approved template name is set for this message");

  if (prior) await db.put("message_logs", { ...prior, status: "queued", error: undefined, reason: undefined, providerMessageId: undefined, updatedAt: now() });
  else if (!(await db.create("message_logs", base))) return (await db.get<MessageLog>("message_logs", id)) ?? base; // a parallel request claimed it first

  const store = await db.get<{ storeName?: string }>("settings", "store");
  const r = await sendRaw(cfg, buildPayload(kind, to, order, cfg, { storeName: store?.storeName || "DaffoMart", siteUrl: SITE_URL }));
  const done = r.ok ? await finish(id, { status: "accepted", providerMessageId: r.messageId, httpStatus: r.httpStatus }) : await finish(id, { status: "failed", error: r.error, httpStatus: r.httpStatus });
  return done ?? base;
}

/** New order: alert the admin and/or confirm to the customer, as configured. Never throws. */
export async function notifyOrderPlaced(order: Order): Promise<MessageLog[]> {
  try {
    const cfg = await getWhatsAppConfig(); if (!cfg.enabled) return [];
    const jobs: Promise<MessageLog>[] = [];
    if (cfg.notifyCustomerOnOrder) jobs.push(deliver({ kind: "orderPlaced", order, to: order.phone }, cfg));
    if (cfg.notifyAdminOnOrder && cfg.adminNotifyNumber) jobs.push(deliver({ kind: "adminNewOrder", order, to: cfg.adminNotifyNumber }, cfg));
    return (await Promise.allSettled(jobs)).flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  } catch (e) { console.error("[whatsapp] order notification failed", e); return []; }
}
export async function notifyOrderStatus(order: Order): Promise<MessageLog[]> {
  try {
    const cfg = await getWhatsAppConfig();
    if (!cfg.enabled || !cfg.notifyCustomerOnStatus || !cfg.statusesToNotify.includes(order.status)) return [];
    return [await deliver({ kind: "statusUpdate", order, to: order.phone, variant: order.status }, cfg)];
  } catch (e) { console.error("[whatsapp] status notification failed", e); return []; }
}

/** Admin "retry" for a skipped / failed / stuck message. */
export async function retryMessage(id: string) {
  const l = await db.get<MessageLog>("message_logs", id); if (!l || !l.orderId) return null;
  if (l.status !== "failed" && l.status !== "skipped" && !(l.status === "queued" && Date.now() - Date.parse(l.updatedAt) > 120_000)) return l;
  const order = await db.get<Order>("orders", l.orderId); if (!order || l.kind === "test") return l;
  return deliver({ kind: l.kind, order, to: l.to, logId: l.id, force: true });
}

/** Admin "send test": a real API call to a number the admin types. Uses a template or text exactly as configured. */
export async function sendTest(to: string) {
  const cfg = await getWhatsAppConfig(); const num = waNumber(to, cfg.defaultCountryCode);
  const demo: Order = { id: "test", orderNo: "DM-TEST", name: "Test Customer", phone: to, address: "Test address", zone: "", zoneName: "Test area", payment: "cod", note: "", items: [{ id: "x", name: "Test item", unit: "1 pc", price: 100, qty: 1 }], subtotal: 100, delivery: 0, discount: 0, total: 100, status: "pending", createdAt: now(), updatedAt: now() };
  const id = "wa_test_" + createHash("sha256").update(String(Date.now()) + to).digest("hex").slice(0, 10);
  const base: MessageLog = { id, channel: "whatsapp", kind: "test", to: num ?? to, status: "queued", createdAt: now(), updatedAt: now() };
  const stop = async (reason: string) => { await db.put("message_logs", { ...base, status: "skipped", reason }); return { ok: false as const, status: "skipped" as const, message: reason }; };
  if (!cfg.phoneNumberId) return stop("Phone Number ID is not set"); if (!process.env.WHATSAPP_ACCESS_TOKEN) return stop("WHATSAPP_ACCESS_TOKEN is not set on the server"); if (!num) return stop("That is not a valid WhatsApp number");
  const kind: WaTemplateKind = "orderPlaced"; if (cfg.messageMode === "template" && !cfg.templates[kind].name) return stop("Set the template name for “order placed” first");
  await db.put("message_logs", base);
  const r = await sendRaw(cfg, buildPayload(kind, num, demo, cfg, { storeName: "DaffoMart", siteUrl: SITE_URL }));
  if (r.ok) { await finish(id, { status: "accepted", providerMessageId: r.messageId, httpStatus: r.httpStatus }); return { ok: true as const, status: "accepted" as const, message: "WhatsApp accepted the message. Delivery to the phone is confirmed separately (see the log below once the webhook reports it)." }; }
  await finish(id, { status: "failed", error: r.error, httpStatus: r.httpStatus }); return { ok: false as const, status: "failed" as const, message: r.error };
}

/* ---------- webhook (delivery receipts) ---------- */
export function verifySignature(rawBody: string, header: string | null, secret: string | undefined) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = createHmac("sha256", secret).update(rawBody).digest(); let got: Buffer;
  try { got = Buffer.from(header.slice(7), "hex"); } catch { return false; }
  return got.length === want.length && timingSafeEqual(got, want);
}
const RANK: Record<MessageStatus, number> = { queued: 0, skipped: 0, failed: 1, accepted: 1, sent: 2, delivered: 3, read: 4 };
/** Applies Meta status callbacks to the logs. Only moves a message forward (read never goes back to delivered). */
export async function applyWebhook(body: any) {
  let updated = 0;
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) for (const ch of Array.isArray(entry?.changes) ? entry.changes : []) for (const st of Array.isArray(ch?.value?.statuses) ? ch.value.statuses : []) {
    const next = String(st?.status ?? "") as MessageStatus; if (!["sent", "delivered", "read", "failed"].includes(next) || !st?.id) continue;
    for (const l of await db.find<MessageLog>("message_logs", "providerMessageId", String(st.id))) {
      if (next !== "failed" && RANK[next] <= RANK[l.status]) continue; if (next === "failed" && (l.status === "delivered" || l.status === "read")) continue;
      const err = next === "failed" ? String(st?.errors?.[0]?.title || st?.errors?.[0]?.message || "Delivery failed").slice(0, 300) : undefined;
      await finish(l.id, { status: next, ...(err ? { error: err } : {}) }); updated++;
    }
  }
  return updated;
}
