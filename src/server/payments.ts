import type { CustomPaymentMethod, Order, PaymentOption, StoreSettings } from "@/lib/types";
import { db } from "./db";
import { testGateway } from "./gateways/test";

/**
 * ───────── Online payment gateway plug-in point ─────────
 * Today: Cash on delivery + manual bKash/Nagad (customer sends money, enters TrxID, admin verifies).
 *        The "Online payment" option is already on the checkout page: it shows as "coming soon" (not selectable) until a gateway is connected.
 * Later: write ONE adapter (e.g. SSLCommerz, AamarPay, bKash PGW, Nagad PGW) implementing GatewayAdapter,
 * register it below and set its keys in environment variables. The checkout "Online payment" option then
 * switches on automatically (once Admin → Payments → "Online payment" is enabled). See PAYMENTS.md.
 */
export interface GatewayAdapter {
  name: string;
  /** true when every required environment variable is present */
  isConfigured(): boolean;
  /** create a payment session and return the hosted page URL to send the customer to */
  init(order: Order, origin: string): Promise<{ url: string }>;
  /** handle the gateway's redirect/IPN request; say which order it is and whether it was paid */
  /**
   * A REAL adapter must verify the gateway's signature / call the gateway's validation API server-to-server, and return the amount
   * and currency the gateway actually charged. Never derive `paid` from a browser redirect or a client-supplied parameter.
   */
  callback(req: Request): Promise<{ orderNo: string; paid: boolean; ref?: string; amount?: number; currency?: string }>;
}

const adapters: GatewayAdapter[] = [
  // import { sslcommerz } from "./gateways/sslcommerz";  →  sslcommerz,   (real gateways go FIRST)
  testGateway, // sandbox for trying the whole flow — only active when PAYMENT_TEST_MODE=true (never use with real customers)
];
export const gateway = () => adapters.find((a) => a.isConfigured()) ?? null;
export const gatewayInfo = () => { const g = gateway(); return { connected: Boolean(g), name: g?.name ?? "", test: g === testGateway }; };

/** Payment choices a customer may use right now (built-in settings + custom methods from Admin → Payments). */
export async function paymentOptions(s: StoreSettings): Promise<PaymentOption[]> {
  const o: PaymentOption[] = [];
  if (s.payCod) o.push({ id: "cod", label: "Cash on delivery", hint: "Pay in cash when you receive your order." });
  if (s.payBkash && s.bkashNumber) o.push({ id: "bkash", label: "bKash", hint: "Send money, then enter the TrxID.", number: s.bkashNumber });
  if (s.payNagad && s.nagadNumber) o.push({ id: "nagad", label: "Nagad", hint: "Send money, then enter the TrxID.", number: s.nagadNumber });
  if (s.payOnline) {
    const g = gateway();
    o.push(g
      ? { id: "online", label: "Online payment", hint: g === testGateway ? "TEST MODE — no real money is charged." : "Card / mobile banking via secure payment page." }
      : { id: "online", label: "Online payment", hint: "Card / mobile banking — coming soon.", disabled: true });
  }
  // Custom methods managed from Admin → Payments (Rocket, Upay, bank transfer …)
  try {
    const customs = (await db.list<CustomPaymentMethod>("payment_methods"))
      .filter((m) => m.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    for (const m of customs) o.push({ id: m.id, label: m.label, hint: m.hint || (m.number ? "Send money, then enter the TrxID." : "Follow the instructions at checkout."), number: m.number, icon: m.icon || "💳", requireTrx: m.requireTrx !== false });
  } catch { /* collection empty / first run */ }
  // Admin → Payments → "How it looks": label, hint, logo, colour, order and visibility per method
  const d = s.payDisplay ?? {};
  return o
    .filter((x) => d[x.id]?.visible !== false)
    .map((x) => ({ ...x, label: d[x.id]?.label || x.label, hint: d[x.id]?.hint || x.hint, ...(d[x.id]?.logo ? { logo: d[x.id]!.logo } : {}), ...(d[x.id]?.color ? { color: d[x.id]!.color } : {}) }))
    .sort((a, b) => (d[a.id]?.order ?? 50) - (d[b.id]?.order ?? 50));
}
