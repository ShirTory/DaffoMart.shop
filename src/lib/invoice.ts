import type { InvoiceSettings, Order, StoreSettings } from "./types";
import { BRAND, validHex } from "./theme";

/** Invoice settings with defaults filled from the store settings, so a brand-new shop already gets a good invoice. */
export function resolveInvoice(s: StoreSettings): Required<Pick<InvoiceSettings, "title" | "prefix" | "companyName" | "address" | "phone" | "email" | "accent" | "paper" | "layout" | "signatureLabel">> & InvoiceSettings {
  const i = s.invoice ?? {};
  return {
    ...i,
    title: i.title || "INVOICE", prefix: i.prefix ?? "INV-", companyName: i.companyName || s.storeName,
    address: i.address || s.address || "", phone: i.phone || s.phone || "", email: i.email || s.email || "",
    accent: validHex(i.accent) || validHex(s.primaryColor) || BRAND.primary,
    paper: i.paper || "A4", layout: i.layout || "classic", signatureLabel: i.signatureLabel || "Authorised signature",
    showLogo: i.showLogo !== false, showUnit: i.showUnit !== false, showPaymentInfo: i.showPaymentInfo !== false, showCourier: i.showCourier !== false,
    showCustomerPhone: i.showCustomerPhone !== false, showPaidStamp: i.showPaidStamp !== false,
    footer: i.footer ?? s.invoiceFooter ?? "Thank you for shopping with us!",
  };
}
export const invoiceNo = (o: Pick<Order, "orderNo">, prefix = "INV-") => `${prefix}${o.orderNo.replace(/^DM-/i, "")}`;
