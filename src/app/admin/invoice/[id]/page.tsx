import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import InvoiceDoc from "@/components/invoice/InvoiceDoc";
import PrintBar from "@/components/invoice/PrintBar";
import { db } from "@/server/db";
import { getAdmin } from "@/server/auth";
import { getSettings } from "@/server/queries";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default async function AdminInvoice({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.fullAccess) notFound(); // invoices contain customer details: full Admin access only
  const order = await db.get<Order>("orders", (await params).id); if (!order) notFound();
  const settings = await getSettings();
  return (
    <div className="min-h-screen bg-gray-100">
      <PrintBar back="/admin/orders" paper={settings.invoice?.paper} />
      <div className="p-3 sm:p-6"><div className="shadow-lg"><InvoiceDoc order={order} settings={settings} /></div></div>
    </div>
  );
}
