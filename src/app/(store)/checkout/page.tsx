import type { Metadata } from "next";
import CheckoutForm from "@/components/store/CheckoutForm";
import { getSettings, getZones } from "@/server/queries";
import { paymentOptions } from "@/server/payments";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function CheckoutPage() {
  const [s, zones] = await Promise.all([getSettings(), getZones()]);
  return <CheckoutForm zones={zones} minOrder={s.minOrder} payments={await paymentOptions(s)} instructions={s.payInstructions} serviceCharge={s.serviceCharge ?? 0} courierNote={s.courierOutsideNote ?? ""} />;
}
