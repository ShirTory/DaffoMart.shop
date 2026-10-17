import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { gatewayInfo } from "@/server/payments";
import { taka } from "@/lib/format";
import type { Order } from "@/lib/types";
export const metadata: Metadata = { title: "Test payment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Stand-in for a gateway's hosted payment page (sandbox only). */
export default async function TestPayPage({ searchParams }: { searchParams: Promise<{ no?: string; phone?: string }> }) {
  if (!gatewayInfo().test) notFound();
  const { no = "", phone = "" } = await searchParams;
  const o = (await db.list<Order>("orders")).find((x) => x.orderNo === no.toUpperCase() && x.phone === phone && x.payment === "online");
  if (!o) notFound();
  const q = encodeURIComponent(o.orderNo);
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 text-center shadow-card">
      <p className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">TEST MODE · no real money is charged</p>
      <h1 className="mt-4 text-xl font-bold">Online payment</h1>
      <p className="mt-1 text-sm text-gray-500">Order <b className="text-primary">{o.orderNo}</b></p>
      <p className="mt-4 text-3xl font-extrabold text-primary">{taka(o.total)}</p>
      <div className="mt-6 grid gap-3">
        <a href={`/api/payments/online/callback?no=${q}&result=success`} className="btn-primary justify-center py-3">✅ Simulate successful payment</a>
        <a href={`/api/payments/online/callback?no=${q}&result=fail`} className="btn-outline justify-center py-3 text-red-600">✕ Simulate failed payment</a>
      </div>
    </div>
  );
}
