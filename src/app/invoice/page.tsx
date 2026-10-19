import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import InvoiceDoc from "@/components/invoice/InvoiceDoc";
import PrintBar from "@/components/invoice/PrintBar";
import { db } from "@/server/db";
import { getSettings } from "@/server/queries";
import { rateLimit } from "@/server/http";
import { normPhone } from "@/lib/format";
import { themeVars } from "@/lib/theme";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default async function CustomerInvoice({ searchParams }: { searchParams: Promise<{ no?: string; phone?: string }> }) {
  const sp = await searchParams;
  const no = (sp.no ?? "").trim().toUpperCase(), phone = normPhone((sp.phone ?? "").trim());
  const h = await headers(); const ip = h.get("x-nf-client-connection-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  let order: Order | undefined, limited = false;
  try { rateLimit(`invoice:${ip}`, 30, 10 * 60_000); } catch { limited = true; }
  if (!limited && no && phone) order = (await db.find<Order>("orders", "orderNo", no)).find((x) => x.phone === phone);
  const settings = await getSettings();
  if (!order) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-4xl">🧾</p>
      <h1 className="mt-3 text-xl font-bold">{limited ? "Too many attempts" : "Invoice not found"}</h1>
      <p className="mt-1 text-sm text-gray-500">{limited ? "Please wait a few minutes and try again." : "Open your invoice from the Track order page — it needs your order number and the phone number used at checkout."}</p>
      <Link href="/track" className="btn-primary mt-5 inline-flex">Track order</Link>
    </div>
  );
  const { passHash, ...rest } = order as Order & { passHash?: string }; void passHash;
  const safe: Order = { ...rest, items: rest.items.map(({ cost, ...i }) => i) }; // purchase cost is not for customers
  return (
    <div style={themeVars(settings) as React.CSSProperties} className="min-h-screen bg-gray-100">
      <PrintBar back={`/track?no=${encodeURIComponent(order.orderNo)}&phone=${encodeURIComponent(order.phone)}`} paper={settings.invoice?.paper} />
      <div className="p-3 sm:p-6"><div className="shadow-lg"><InvoiceDoc order={safe} settings={settings} /></div></div>
    </div>
  );
}
