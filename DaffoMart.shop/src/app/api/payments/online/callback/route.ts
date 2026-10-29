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
  const o = (await db.find<Order>("orders", "orderNo", r.orderNo))[0];
  if (!o || o.payment !== "online") throw new ApiError(404, "Order not found"); // only online-payment orders can be settled here
  if (o.paymentStatus !== "paid") { // an already-paid order is never changed again (idempotent: replays do nothing)
    if (r.paid) {
      const dead = ["cancelled", "returned"].includes(o.status);
      const wrongAmount = r.amount !== undefined && Math.abs(r.amount - o.total) > 0.5;
      const wrongCurrency = r.currency !== undefined && r.currency.toUpperCase() !== "BDT";
      const refReused = r.ref ? (await db.find<Order>("orders", "paymentRef", r.ref)).some((x) => x.id !== o.id && !["cancelled", "returned"].includes(x.status)) : false;
      if (dead || wrongAmount || wrongCurrency || refReused) console.error("[payment] refused to mark paid", { orderNo: o.orderNo, dead, wrongAmount, wrongCurrency, refReused }); // needs a human to look at it
      else await db.update<Order>("orders", o.id, { paymentStatus: "paid", paymentRef: r.ref ?? o.paymentRef, updatedAt: new Date().toISOString() });
    } else await setPaymentStatus(o.id, "failed");
  }
  return NextResponse.redirect(new URL(`/track?no=${encodeURIComponent(o.orderNo)}&phone=${encodeURIComponent(o.phone)}`, req.url), 303);
}
export const GET = handle(done);
export const POST = handle(done);
