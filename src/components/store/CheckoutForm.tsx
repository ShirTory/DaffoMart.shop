"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { useCart } from "@/lib/store";
import { saveLastOrder } from "@/lib/lastOrder";
import { useCartSync, useCoupon } from "@/lib/hooks";
import { taka } from "@/lib/format";
import { mapsEmbed } from "@/lib/maps";
import type { DeliveryZone, PaymentOption } from "@/lib/types";
import { useT } from "./TextsProvider";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().regex(/^01[3-9]\d{8}$/, "Enter a valid mobile number (01XXXXXXXXX)"),
  address: z.string().trim().min(8, "Enter your full address"),
  zone: z.string().min(1, "Choose a delivery area"),
  note: z.string().optional(),
  payment: z.string().min(1, "Choose a payment method"),
  paymentRef: z.string().trim().optional(),
  paymentFrom: z.string().trim().optional(),
});
type FormData = z.infer<typeof schema>;

export default function CheckoutForm({ zones, minOrder = 0, payments, instructions = "", serviceCharge = 0, courierNote = "" }: { zones: DeliveryZone[]; minOrder?: number; payments: PaymentOption[]; instructions?: string; serviceCharge?: number; courierNote?: string }) {
  const { items, clear } = useCart(); const t = useT();
  const [mounted, setMounted] = useState(false); const [placed, setPlaced] = useState<{ orderNo: string; phone: string; payLater?: boolean } | null>(null); const [error, setError] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null); const [locMsg, setLocMsg] = useState(""); const [locBusy, setLocBusy] = useState(false);
  useEffect(() => setMounted(true), []);
  useCartSync();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { zone: zones[0]?.id ?? "", payment: (payments.find((p) => !p.disabled) ?? payments[0])?.id ?? "" } });
  const zone = watch("zone"); const pay = watch("payment"); const payOpt = payments.find((p) => p.id === pay);
  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  const c = useCoupon(subtotal);
  if (!mounted) return null;
  const zn = zones.find((x) => x.id === zone);
  const fee = !zn ? 0 : zn.freeOver > 0 && subtotal - c.discount >= zn.freeOver ? 0 : zn.charge;
  const hasRx = items.some((i) => i.rx);
  const svc = Math.max(0, Number(serviceCharge) || 0);
  const total = subtotal - c.discount + fee + svc;

  const locate = () => {
    if (!navigator.geolocation) return setLocMsg("Your browser cannot share location. Please type the full address.");
    setLocBusy(true); setLocMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setPin({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }); setLocBusy(false); },
      () => { setLocBusy(false); setLocMsg("Could not get your location. Allow location access, or just type the full address."); },
      { enableHighAccuracy: true, timeout: 12000 });
  };

  const onSubmit = async (d: FormData) => {
    setError("");
    try {
      const selected = payments.find((p) => p.id === d.payment);
      const manual = d.payment === "bkash" || d.payment === "nagad" || (d.payment !== "cod" && d.payment !== "online" && selected?.requireTrx !== false);
      const r = await api<{ orderNo: string }>("/api/orders", { method: "POST", body: { ...d, paymentRef: manual ? d.paymentRef : undefined, paymentFrom: manual ? d.paymentFrom : undefined, lat: pin?.lat, lng: pin?.lng, couponCode: c.code || undefined, items: items.map((i) => ({ id: i.id, qty: i.qty })) } });
      let payLater = false;
      if (d.payment === "online") { // hand over to the payment gateway page
        try { const g = await api<{ url: string }>("/api/payments/online/init", { method: "POST", body: { orderNo: r.orderNo, phone: d.phone } }); saveLastOrder(r.orderNo, items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, price: i.price, qty: i.qty, image: i.image, emoji: i.emoji }))); clear(); window.location.href = g.url; return; }
        catch { payLater = true; /* gateway unavailable: order is saved, the customer can retry from the Track page */ }
      }
      saveLastOrder(r.orderNo, items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, price: i.price, qty: i.qty, image: i.image, emoji: i.emoji })));
      clear(); setPlaced({ orderNo: r.orderNo, phone: d.phone, payLater });
    } catch (e: any) { setError(e.message); }
  };

  const placedManual = pay === "bkash" || pay === "nagad" || (pay !== "cod" && pay !== "online" && payOpt?.requireTrx !== false);
  if (placed) return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-white p-10 text-center shadow-card">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✅</div>
      <h1 className="mt-4 text-2xl font-bold">{t("checkout.thanks")}</h1>
      <p className="mt-2 text-gray-600">Your order number is</p><p className="mt-1 text-2xl font-extrabold tracking-wider text-primary">{placed.orderNo}</p>
      {placed.payLater && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your online payment was not completed. You can retry anytime from the Track page.</p>}
      <p className="mt-3 text-sm text-gray-500">{placedManual ? "We will verify your payment and then confirm your order. " : ""}{t("checkout.thanksText")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href={`/track?no=${placed.orderNo}&phone=${placed.phone}`} className="btn-primary">{t("checkout.trackBtn")}</Link><Link href={`/invoice?no=${encodeURIComponent(placed.orderNo)}&phone=${encodeURIComponent(placed.phone)}`} className="btn-outline" target="_blank">🧾 {t("checkout.invoiceBtn")}</Link><Link href="/products" className="btn-outline">{t("checkout.continue")}</Link></div>
    </div>);
  if (!items.length) return <div className="rounded-2xl border bg-white p-12 text-center shadow-card"><p className="text-4xl">🛒</p><p className="mt-2 font-semibold">Your cart is empty</p><Link href="/products" className="btn-primary mt-4">Shop now</Link></div>;

  const Err = ({ m }: { m?: string }) => (m ? <p className="mt-1 text-xs text-red-600">{m}</p> : null);
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5 rounded-2xl border bg-white p-5 shadow-card sm:p-6">
        <div><h1 className="text-xl font-bold">{t("checkout.details")}</h1><p className="text-sm text-gray-500">No account needed — just tell us where to deliver.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Full name</label><input className="input" placeholder="Your name" autoComplete="name" {...register("name")} /><Err m={errors.name?.message} /></div>
          <div><label className="label">Mobile number</label><input className="input" placeholder="01XXXXXXXXX" inputMode="numeric" autoComplete="tel" {...register("phone")} /><Err m={errors.phone?.message} /></div>
        </div>
        <div><label className="label">Full address</label><textarea className="input" rows={2} placeholder="House, road, area" autoComplete="street-address" {...register("address")} /><Err m={errors.address?.message} /></div>
        <div><label className="label">Delivery location (optional)</label>
          <div className="rounded-xl border border-dashed border-gray-300 p-3.5 text-sm">
            <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={locate} disabled={locBusy} className="btn-outline">{locBusy ? "Finding…" : pin ? "📍 Update my location" : "📍 Use my current location"}</button><span className="text-xs text-gray-500">{pin ? "Location attached — the rider can navigate exactly to you." : "Helps the rider find you faster."}</span></div>
            {locMsg && <p className="mt-2 text-xs text-red-600">{locMsg}</p>}
            {pin && <><iframe title="Your location" src={mapsEmbed(pin)} className="mt-3 h-40 w-full rounded-lg border-0" loading="lazy" /><button type="button" onClick={() => setPin(null)} className="mt-1 text-xs font-medium text-red-600 hover:underline">Remove location</button></>}</div></div>
        <div><label className="label">Delivery area</label>
          <div className="grid gap-3 sm:grid-cols-2">{zones.map((x) => (
            <label key={x.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border-2 p-3.5 text-sm transition ${zone === x.id ? "border-primary bg-primary-soft" : "border-gray-200"}`}><span className="flex items-center gap-2"><input type="radio" value={x.id} {...register("zone")} className="accent-primary" /><span><b>{x.name}</b>{x.eta && <span className="block text-xs text-gray-500">{x.eta}</span>}</span></span><span className="text-right text-gray-600">{x.charge === 0 ? "Free" : taka(x.charge)}{x.freeOver > 0 && <span className="block text-[11px] text-emerald-700">Free over {taka(x.freeOver)}</span>}</span></label>))}</div>
          {zones.find((x) => x.id === zone)?.viaCourier && courierNote && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">🚚 {courierNote}</p>}<Err m={errors.zone?.message} />{zones.length === 0 && <p className="mt-1 text-xs text-red-600">Delivery is not available right now. Please contact us.</p>}</div>
        {hasRx && <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"><b>℞ Prescription medicine in your cart.</b> Our pharmacist will call you to confirm your prescription before delivery. Please keep it ready.</div>}
        <div><label className="label">Payment method</label>
          <div className="grid gap-3 sm:grid-cols-2">{payments.map((p) => (
            <label key={p.id} className={`flex items-start gap-2 rounded-xl border-2 p-3.5 text-sm transition ${p.disabled ? "cursor-not-allowed border-dashed border-gray-200 bg-gray-50 opacity-70" : pay === p.id ? "cursor-pointer border-primary bg-primary-soft" : "cursor-pointer border-gray-200"}`}><input type="radio" value={p.id} disabled={p.disabled} {...register("payment")} className="mt-0.5 accent-primary" /><span><b className="inline-flex items-center gap-1.5">{p.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.logo} alt="" className="h-5 w-auto max-w-[56px] object-contain" /> : (p.icon || (p.id === "cod" ? "💵" : p.id === "online" ? "💳" : "📱")) + " "}<span style={p.color ? { color: p.color } : undefined}>{p.label}</span></b>{p.disabled && <span className="badge ml-2 bg-gray-200 text-gray-600">Coming soon</span>}<span className="block text-xs text-gray-500">{p.hint}</span></span></label>))}</div>
          <Err m={errors.payment?.message} />
          {placedManual && payOpt && (
            <div className="mt-3 space-y-3 rounded-xl bg-amber-50 p-4 text-sm">{payOpt.number ? <p>Send <b>{taka(total)}</b> to <b className="font-mono text-base">{payOpt.number}</b> ({payOpt.label}).</p> : <p>Pay <b>{taka(total)}</b> via <b>{payOpt.label}</b>. {payOpt.hint}</p>}{instructions && <p className="text-xs text-amber-900">{instructions}</p>}
              <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Transaction ID (TrxID)</label><input className="input uppercase" placeholder="e.g. 9A7B6C5D4E" {...register("paymentRef")} /></div><div><label className="label">Number you paid from</label><input className="input" inputMode="numeric" placeholder="01XXXXXXXXX" {...register("paymentFrom")} /></div></div></div>)}
          {payments.length === 0 && <p className="mt-1 text-xs text-red-600">No payment method is available right now. Please contact us.</p>}</div>
        <div><label className="label">Order note (optional)</label><textarea className="input" rows={2} placeholder="Any special instruction for delivery" {...register("note")} /></div>
      </div>
      <aside className="h-fit space-y-3 rounded-2xl border bg-white p-5 text-sm shadow-card lg:sticky lg:top-40">
        <h2 className="text-base font-bold">{t("checkout.summary")}</h2>
        <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">{items.map((i) => (
          <li key={i.id} className="flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-xl">{i.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt="" className="h-full w-full object-cover" /> : i.emoji}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{i.name}</p><p className="text-xs text-gray-500">{i.qty} × {taka(i.price)}</p></div><span className="font-semibold">{taka(i.price * i.qty)}</span></li>))}</ul>
        <hr />
        <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{taka(subtotal)}</span></div>
        {c.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount ({c.code})</span><span>−{taka(c.discount)}</span></div>}
        <div className="flex justify-between"><span className="text-gray-600">Delivery</span><span>{fee === 0 ? "Free" : taka(fee)}</span></div>
        {svc > 0 && <div className="flex justify-between"><span className="text-gray-600">Service charge</span><span>{taka(svc)}</span></div>}
        <div className="flex justify-between border-t pt-3 text-lg font-extrabold"><span>Total</span><span className="text-primary">{taka(total)}</span></div>
        {c.error && c.code && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">Coupon not applied: {c.error}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {minOrder > 0 && subtotal < minOrder && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Minimum order amount is {taka(minOrder)}. Add {taka(minOrder - subtotal)} more.</p>}
        <button className="btn-accent w-full py-3 text-base" disabled={isSubmitting || !zones.length || !payments.some((p) => !p.disabled) || (minOrder > 0 && subtotal < minOrder)}>{isSubmitting ? t("checkout.placing") : t("checkout.place")}</button>
        <Link href="/cart" className="block text-center text-xs text-gray-500 hover:text-primary">← Edit cart</Link>
      </aside>
    </form>
  );
}
