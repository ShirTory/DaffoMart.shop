/**
 * WhatsApp + calling settings. Stored in the admin-only `integrations` collection (never in the public `settings`
 * document). API secrets are NOT stored anywhere in the database: they are read from environment variables only
 * (WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN) and are never sent to the browser.
 */
import { db } from "../db";
import { ApiError } from "../http";
import { ORDER_STATUSES } from "@/lib/types";
import { normalizeBdPhone } from "@/lib/phone";
import type { CallingConfig, OrderStatus, WaTemplateKind, WhatsAppConfig } from "@/lib/types";

export const WA_KINDS: WaTemplateKind[] = ["orderPlaced", "adminNewOrder", "statusUpdate"];
/** Order fields an admin can map to template variables {{1}}, {{2}} … */
export const WA_TOKENS = ["storeName", "orderNo", "customerName", "customerPhone", "total", "subtotal", "delivery", "status", "address", "area", "items", "payment", "trackUrl"] as const;

export const defaultWhatsApp = (): WhatsAppConfig => ({
  id: "whatsapp", enabled: false, provider: "meta_cloud", phoneNumberId: "", businessAccountId: "", apiVersion: "v21.0", defaultCountryCode: "880", adminNotifyNumber: "",
  notifyAdminOnOrder: true, notifyCustomerOnOrder: true, notifyCustomerOnStatus: false, statusesToNotify: ["confirmed", "on_the_way", "delivered", "cancelled"],
  messageMode: "template",
  templates: {
    orderPlaced: { name: "", language: "en", params: ["customerName", "orderNo", "total"] },
    adminNewOrder: { name: "", language: "en", params: ["orderNo", "customerName", "customerPhone", "total"] },
    statusUpdate: { name: "", language: "en", params: ["customerName", "orderNo", "status"] },
  },
  textTemplates: {
    orderPlaced: "Hi {{customerName}}, thank you for your order {{orderNo}} at {{storeName}}. Total: {{total}}. Track: {{trackUrl}}",
    adminNewOrder: "New order {{orderNo}} from {{customerName}} ({{customerPhone}}). Total {{total}}. {{items}}",
    statusUpdate: "Hi {{customerName}}, your order {{orderNo}} is now: {{status}}.",
  },
});
export const defaultCalling = (): CallingConfig => ({ id: "calling", enabled: false, provider: "none", displayNumber: "", callerId: "", hours: "", note: "" });

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const s = await db.get<Partial<WhatsAppConfig>>("integrations", "whatsapp"); const d = defaultWhatsApp();
  return { ...d, ...(s ?? {}), id: "whatsapp", templates: { ...d.templates, ...(s?.templates ?? {}) }, textTemplates: { ...d.textTemplates, ...(s?.textTemplates ?? {}) } };
}
export async function getCallingConfig(): Promise<CallingConfig> {
  const s = await db.get<Partial<CallingConfig>>("integrations", "calling"); return { ...defaultCalling(), ...(s ?? {}), id: "calling" };
}

const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const tokenOk = (t: string) => (WA_TOKENS as readonly string[]).includes(t);

/** Validates and normalizes a WhatsApp settings update (only the fields present). Throws ApiError(400) with per-field messages. */
export function parseWhatsAppConfig(raw: Record<string, any>, cur: WhatsAppConfig): WhatsAppConfig {
  const errors: Record<string, string> = {}; const next: WhatsAppConfig = JSON.parse(JSON.stringify(cur));
  const has = (k: string) => raw[k] !== undefined;
  for (const k of ["enabled", "notifyAdminOnOrder", "notifyCustomerOnOrder", "notifyCustomerOnStatus"] as const) if (has(k)) next[k] = Boolean(raw[k]);
  if (has("phoneNumberId")) { const v = str(raw.phoneNumberId, 40); if (v && !/^\d{5,24}$/.test(v)) errors.phoneNumberId = "The Phone Number ID is digits only (find it in Meta → WhatsApp → API setup)"; else next.phoneNumberId = v; }
  if (has("businessAccountId")) { const v = str(raw.businessAccountId, 40); if (v && !/^\d{5,24}$/.test(v)) errors.businessAccountId = "Digits only"; else next.businessAccountId = v; }
  if (has("apiVersion")) { const v = str(raw.apiVersion, 10); if (!/^v\d{1,2}\.\d$/.test(v)) errors.apiVersion = "Use a version like v21.0"; else next.apiVersion = v; }
  if (has("defaultCountryCode")) { const v = str(raw.defaultCountryCode, 4).replace(/\D/g, ""); if (!v) errors.defaultCountryCode = "Enter the country code, e.g. 880"; else next.defaultCountryCode = v; }
  if (has("adminNotifyNumber")) { const v = str(raw.adminNotifyNumber, 30); if (v && !normalizeBdPhone(v) && !/^\+?\d{10,15}$/.test(v.replace(/[\s-]/g, ""))) errors.adminNotifyNumber = "Enter a valid WhatsApp number"; else next.adminNotifyNumber = v; }
  if (has("messageMode")) { if (raw.messageMode !== "template" && raw.messageMode !== "text") errors.messageMode = "Choose template or text"; else next.messageMode = raw.messageMode; }
  if (has("statusesToNotify")) { const a = Array.isArray(raw.statusesToNotify) ? raw.statusesToNotify : []; next.statusesToNotify = a.filter((s: string) => ORDER_STATUSES.includes(s as OrderStatus)); }
  if (raw.templates && typeof raw.templates === "object") for (const k of WA_KINDS) { const t = raw.templates[k]; if (!t) continue;
    const name = str(t.name, 80), language = str(t.language, 10) || "en"; const params = (Array.isArray(t.params) ? t.params : String(t.params ?? "").split(",")).map((p: unknown) => String(p).trim()).filter(Boolean).slice(0, 10);
    if (name && !/^[a-z0-9_]+$/.test(name)) errors[`templates.${k}.name`] = "Template names use lowercase letters, numbers and _ only";
    else if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(language)) errors[`templates.${k}.language`] = "Use a code like en or en_US";
    else if (params.some((p: string) => !tokenOk(p))) errors[`templates.${k}.params`] = "Unknown field. Allowed: " + WA_TOKENS.join(", ");
    else next.templates[k] = { name, language, params }; }
  if (raw.textTemplates && typeof raw.textTemplates === "object") for (const k of WA_KINDS) if (raw.textTemplates[k] !== undefined) next.textTemplates[k] = str(raw.textTemplates[k], 1000);
  if (next.enabled) {
    if (!next.phoneNumberId) errors.phoneNumberId = "Enter your WhatsApp Phone Number ID before turning automatic messages on";
    if (next.messageMode === "template") for (const k of WA_KINDS) {
      const used = k === "adminNewOrder" ? next.notifyAdminOnOrder : k === "orderPlaced" ? next.notifyCustomerOnOrder : next.notifyCustomerOnStatus;
      if (used && !next.templates[k].name) errors[`templates.${k}.name`] = "Template mode needs the name of a template approved in Meta Business Manager";
    }
    if (next.notifyAdminOnOrder && !next.adminNotifyNumber) errors.adminNotifyNumber = "Enter the number that should receive new-order alerts, or turn that alert off";
  }
  if (Object.keys(errors).length) throw new ApiError(400, Object.values(errors)[0], errors);
  return next;
}

export function parseCallingConfig(raw: Record<string, any>, cur: CallingConfig): CallingConfig {
  const errors: Record<string, string> = {}; const next = { ...cur };
  if (raw.enabled !== undefined) next.enabled = Boolean(raw.enabled);
  if (raw.provider !== undefined) { if (!["none", "twilio", "exotel", "custom"].includes(raw.provider)) errors.provider = "Unknown provider"; else next.provider = raw.provider; }
  for (const [k, n] of [["displayNumber", 30], ["callerId", 30], ["hours", 120], ["note", 300]] as const) if (raw[k] !== undefined) (next as any)[k] = str(raw[k], n);
  for (const k of ["displayNumber", "callerId"] as const) if (next[k] && !normalizeBdPhone(next[k]) && !/^\+?\d{8,15}$/.test(next[k].replace(/[\s-]/g, ""))) errors[k] = "Enter a valid phone number";
  if (Object.keys(errors).length) throw new ApiError(400, Object.values(errors)[0], errors);
  return next;
}

export async function saveIntegration<T extends { id: string }>(cfg: T, actor: string) { return db.put("integrations", { ...cfg, updatedAt: new Date().toISOString(), updatedBy: actor } as T); }

/** Which secrets are present in the environment (booleans only: values are never exposed). */
export function waEnvStatus() {
  const t = Boolean(process.env.WHATSAPP_ACCESS_TOKEN), a = Boolean(process.env.WHATSAPP_APP_SECRET), v = Boolean(process.env.WHATSAPP_VERIFY_TOKEN);
  return { accessToken: t, appSecret: a, verifyToken: v, missing: [!t && "WHATSAPP_ACCESS_TOKEN", !a && "WHATSAPP_APP_SECRET", !v && "WHATSAPP_VERIFY_TOKEN"].filter(Boolean) as string[] };
}
