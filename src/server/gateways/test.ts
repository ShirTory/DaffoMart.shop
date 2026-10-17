import type { GatewayAdapter } from "../payments";

/**
 * SANDBOX gateway — lets you click through the full online-payment flow (checkout → payment page → back to tracking)
 * before a real provider is connected. It moves NO money and anyone can "pay" for free, so it only switches on when
 * PAYMENT_TEST_MODE=true. Leave that variable OUT on the live site once a real gateway is connected.
 */
export const testGateway: GatewayAdapter = {
  name: "Test gateway (sandbox)",
  isConfigured: () => process.env.PAYMENT_TEST_MODE === "true",
  async init(order, origin) { return { url: `${origin}/pay/test?no=${encodeURIComponent(order.orderNo)}&phone=${encodeURIComponent(order.phone)}` }; },
  async callback(req) {
    const u = new URL(req.url); const orderNo = (u.searchParams.get("no") ?? "").toUpperCase();
    return { orderNo, paid: u.searchParams.get("result") === "success", ref: "TEST-" + Date.now().toString(36).toUpperCase() };
  },
};
