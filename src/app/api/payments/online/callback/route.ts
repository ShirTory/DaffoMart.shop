import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { ApiError, handle } from "@/server/http";
import { gateway } from "@/server/payments";
import { setPaymentStatus } from "@/server/services";
import type { Order } from "@/lib/types";
export const dynamic = "force-dynamic";

/** The payment gateway redirects / posts here. The adapter verifies it; we then mark the order paid or failed. */
async function done(req: Request) {
  const gw = gateway(); if (!gw) throw new ApiError(503, "Online payment is not available");
  const r = await gw.callback(req);
  const o = (await db.list<Order>("orders")).find((x) => x.orderNo === r.orderNo);
  if (!o || o.payment !== "online") throw new ApiError(404, "Order not found"); // only online-payment orders can be settled here
  if (o.paymentStatus !== "paid") { // an already-paid order is never changed again (no paid -> failed downgrade, no double-processing)
    if (r.paid) await db.update<Order>("orders", o.id, { paymentStatus: "paid", paymentRef: r.ref ?? o.paymentRef, updatedAt: new Date().toISOString() });
    else await setPaymentStatus(o.id, "failed");
  }
  return NextResponse.redirect(new URL(`/track?no=${encodeURIComponent(o.orderNo)}&phone=${encodeURIComponent(o.phone)}`, req.url), 303);
}
export const GET = handle(done);
export const POST = handle(done);
