/**
 * Calling integration — MODULAR PLACEHOLDER. No call provider is implemented or activated yet.
 * What already works without any provider: tap-to-call (`tel:` links) on the storefront using the phone number in Settings.
 * To activate a provider later: implement `CallProvider.startCall` for it, set `implemented: true`, add its credentials as
 * environment variables, and select it in Admin → WhatsApp & Calling. Nothing here ever reports a call as placed unless a
 * provider returns a real call id.
 */
import { ApiError } from "../http";
import type { CallingConfig } from "@/lib/types";

export interface CallRequest { to: string; orderId?: string; agent?: string }
export interface CallResult { ok: true; callId: string }
export interface CallProvider { id: CallingConfig["provider"]; label: string; implemented: boolean; envVars: string[]; startCall?: (cfg: CallingConfig, req: CallRequest) => Promise<CallResult> }

export const CALL_PROVIDERS: CallProvider[] = [
  { id: "none", label: "None (tap-to-call links only)", implemented: true, envVars: [] },
  { id: "twilio", label: "Twilio Voice (placeholder)", implemented: false, envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] },
  { id: "exotel", label: "Exotel (placeholder)", implemented: false, envVars: ["EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_SID"] },
  { id: "custom", label: "Custom provider (placeholder)", implemented: false, envVars: ["CALL_API_URL", "CALL_API_KEY"] },
];

export function callingStatus(cfg: CallingConfig) {
  const p = CALL_PROVIDERS.find((x) => x.id === cfg.provider) ?? CALL_PROVIDERS[0];
  const missing = p.envVars.filter((v) => !process.env[v]);
  const active = cfg.enabled && p.id !== "none" && p.implemented && !!p.startCall && missing.length === 0;
  return { provider: p.id, label: p.label, implemented: p.implemented, active, missing, message: p.id === "none" ? "Only tap-to-call links are available. No calling provider is connected." : !p.implemented ? "This provider is a placeholder and is not implemented yet." : missing.length ? `Missing environment variables: ${missing.join(", ")}` : cfg.enabled ? "Ready" : "Turned off" };
}

/** Server-side call request. Refuses (501) unless a real provider is implemented, configured and enabled. */
export async function requestCall(cfg: CallingConfig, req: CallRequest): Promise<CallResult> {
  const st = callingStatus(cfg); const p = CALL_PROVIDERS.find((x) => x.id === cfg.provider);
  if (!st.active || !p?.startCall) throw new ApiError(501, `Calling is not activated. ${st.message}`);
  return p.startCall(cfg, req);
}
export const telHref = (n: string) => "tel:" + n.replace(/[^\d+]/g, "");
