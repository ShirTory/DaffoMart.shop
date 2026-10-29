"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmtDateTime, statusLabel, taka } from "@/lib/format";
import { distanceKm, fmtDistance, mapsDirections, roughEtaMin } from "@/lib/maps";
import LiveMap, { type Pin } from "@/components/maps/LiveMap";
import { useCart } from "@/lib/store";
import type { OrderItem } from "@/lib/types";
import { useT } from "./TextsProvider";
import { saveLastOrder } from "@/lib/lastOrder";

interface Tracked {
  id?: string;
  orderNo: string; status: string; createdAt: string; updatedAt: string;
  items: OrderItem[]; subtotal: number; delivery: number; serviceCharge?: number; discount: number; total: number;
  zoneName?: string; payment?: string; paymentStatus?: string;
  riderId?: string; riderName?: string; riderPhone?: string; riderImage?: string;
  riderRatingAvg?: number; riderRatingCount?: number; eta?: string;
  courierName?: string; trackingNo?: string; courierUrl?: string;
  canCancel?: boolean; cancelEndsAt?: string;
  dest?: { lat: number; lng: number }; riderLoc?: { lat: number; lng: number; ageSec: number };
  rated?: boolean; existingRating?: { stars: number; comment?: string } | null;
  issues?: { id: string; text: string; status: string; photos: string[]; createdAt: string }[];
}
const STEPS = ["pending", "confirmed", "processing", "on_the_way", "delivered"];

export default function TrackForm() {
  const t = useT();
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [no, setNo] = useState(""); const [phone, setPhone] = useState("");
  const [o, setO] = useState<Tracked | null>(null); const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false); const [payBusy, setPayBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false); const [cancelMsg, setCancelMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const [stars, setStars] = useState(5); const [rateComment, setRateComment] = useState(""); const [rateBusy, setRateBusy] = useState(false); const [rateDone, setRateDone] = useState(false);
  const [issueText, setIssueText] = useState(""); const [issueFiles, setIssueFiles] = useState<FileList | null>(null); const [issueBusy, setIssueBusy] = useState(false); const [issueMsg, setIssueMsg] = useState("");
  const [showIssue, setShowIssue] = useState(false);

  const lookup = async (n: string, p: string, silent = false) => {
    if (!silent) { setBusy(true); setErr(""); setO(null); setCancelMsg(""); }
    try {
      const data = await api<Tracked>(`/api/orders/track?no=${encodeURIComponent(n)}&phone=${encodeURIComponent(p)}`);
      setO(data);
      if (data?.items?.length) saveLastOrder(data.orderNo, data.items);
    }
    catch (e: any) { if (!silent) setErr(e.message); }
    finally { if (!silent) setBusy(false); }
  };

  const payNow = async () => {
    if (!o) return; setPayBusy(true); setErr("");
    try { const g = await api<{ url: string }>("/api/payments/online/init", { method: "POST", body: { orderNo: o.orderNo, phone: phone.trim() } }); window.location.href = g.url; }
    catch (e: any) { setErr(e.message); setPayBusy(false); }
  };

  const cancelOrder = async () => {
    if (!o?.canCancel) return;
    if (!confirm("Cancel this order? Stock will be restored. This cannot be undone.")) return;
    setCancelBusy(true); setCancelMsg(""); setErr("");
    try {
      await api("/api/orders/cancel", { method: "POST", body: { no: o.orderNo, phone: phone.trim() } });
      setCancelMsg("Order cancelled. Stock has been restored.");
      await lookup(o.orderNo, phone.trim(), true);
    } catch (e: any) { setErr(e.message); }
    finally { setCancelBusy(false); }
  };

  const reorder = () => {
    if (!o?.items?.length) return;
    saveLastOrder(o.orderNo, o.items);
    for (const i of o.items) {
      add({ id: i.id, slug: i.id, name: i.name, price: i.price, unit: i.unit, emoji: i.emoji || "🛒", image: i.image, ...(i.variantId ? { vid: i.variantId, vlabel: i.variantLabel } : {}) }, i.qty);
    }
    router.push("/cart");
  };

  useEffect(() => { const u = new URLSearchParams(window.location.search); const n = u.get("no"), p = u.get("phone"); if (n && p) { setNo(n); setPhone(p); lookup(n, p); } }, []);
  useEffect(() => {
    if (!o?.canCancel || !o.cancelEndsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [o?.canCancel, o?.cancelEndsAt]);
  const open = !!o && !["delivered", "cancelled", "returned"].includes(o.status);
  const onRoad = !!o && ["picked_up", "on_the_way"].includes(o.status);
  useEffect(() => {
    if (!open || !o) return; const n = o.orderNo, p = phone.trim();
    const t = setInterval(() => { if (document.visibilityState === "visible") lookup(n, p, true); }, onRoad ? 10_000 : 30_000);
    return () => clearInterval(t);
  }, [open, onRoad, o?.orderNo]); // eslint-disable-line react-hooks/exhaustive-deps

  const pins: Pin[] = o ? [...(o.riderLoc ? [{ id: "rider", kind: "rider" as const, lat: o.riderLoc.lat, lng: o.riderLoc.lng, label: o.riderName ?? "Rider" }] : []), ...(o.dest ? [{ id: "home", kind: "home" as const, lat: o.dest.lat, lng: o.dest.lng, label: "Your delivery location" }] : [])] : [];
  const km = o?.riderLoc && o.dest ? distanceKm(o.riderLoc, o.dest) : null;
  const stepIdx = o ? (o.status === "assigned" || o.status === "picked_up" ? 3 : STEPS.indexOf(o.status)) : -1;
  const dead = o && (o.status === "cancelled" || o.status === "returned");
  const cancelSecsLeft = o?.canCancel && o.cancelEndsAt ? Math.max(0, Math.floor((new Date(o.cancelEndsAt).getTime() - now) / 1000)) : 0;
  
  const submitRating = async () => {
    if (!o?.id || !o.riderId) return;
    setRateBusy(true); setErr("");
    try {
      await api("/api/ratings", { method: "POST", body: { orderId: o.id, stars, comment: rateComment || undefined, customerPhone: phone.trim() } });
      setRateDone(true);
      lookup(o.orderNo, phone.trim(), true);
    } catch (e: any) { setErr(e.message); }
    finally { setRateBusy(false); }
  };

  const submitIssue = async () => {
    if (!o?.id || !issueText.trim()) return;
    setIssueBusy(true); setErr(""); setIssueMsg("");
    try {
      const fd = new FormData();
      fd.append("orderId", o.id);
      fd.append("raisedBy", "customer");
      fd.append("text", issueText.trim());
      fd.append("raiserPhone", phone.trim());
      if (issueFiles) for (let i = 0; i < Math.min(issueFiles.length, 5); i++) fd.append("photos", issueFiles[i]);
      const res = await fetch("/api/issues", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not submit issue");
      setIssueMsg("Issue submitted. Our team will review it.");
      setIssueText(""); setIssueFiles(null); setShowIssue(false);
      lookup(o.orderNo, phone.trim(), true);
    } catch (e: any) { setErr(e.message); }
    finally { setIssueBusy(false); }
  };

const stillCanCancel = !!o?.canCancel && cancelSecsLeft > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{t("track.title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("track.hint")}</p>
      <form onSubmit={(e) => { e.preventDefault(); lookup(no.trim(), phone.trim()); }} className="mt-5 grid gap-3 rounded-2xl border bg-white p-5 shadow-card sm:grid-cols-[1fr_1fr_auto]">
        <input className="input uppercase" placeholder="Order no. (DM-XXXXXXX)" value={no} onChange={(e) => setNo(e.target.value)} required aria-label="Order number" />
        <input className="input" placeholder="Mobile number" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} required aria-label="Mobile number" />
        <button className="btn-primary" disabled={busy}>{busy ? "Searching…" : t("track.button")}</button>
      </form>
      {err && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{err}</p>}
      {cancelMsg && <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{cancelMsg}</p>}
      {o && (
        <div className="mt-5 space-y-5 rounded-2xl border bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-xs text-gray-500">Order</p><p className="text-lg font-extrabold text-primary">{o.orderNo}</p></div>
            <div className="text-right"><p className="text-xs text-gray-500">Placed on</p><p className="text-sm font-medium">{fmtDateTime(o.createdAt)}</p></div>
          </div>
          {dead ? (
            <p className="rounded-xl bg-red-50 p-4 text-center font-semibold text-red-700">This order was {statusLabel(o.status).toLowerCase()}.</p>
          ) : (
            <ol className="flex items-start justify-between" aria-label="Order status timeline">
              {STEPS.map((s, k) => (
                <li key={s} className="flex flex-1 flex-col items-center text-center">
                  <div className="flex w-full items-center">
                    <div className={`h-1 flex-1 ${k === 0 ? "opacity-0" : k <= stepIdx ? "bg-primary" : "bg-gray-200"}`} />
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${k <= stepIdx ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}`}>{k <= stepIdx ? "✓" : k + 1}</div>
                    <div className={`h-1 flex-1 ${k === STEPS.length - 1 ? "opacity-0" : k < stepIdx ? "bg-primary" : "bg-gray-200"}`} />
                  </div>
                  <p className={`mt-2 text-[11px] font-medium sm:text-xs ${k <= stepIdx ? "text-primary" : "text-gray-400"}`}>{statusLabel(s === "on_the_way" ? "on the way" : s)}</p>
                </li>
              ))}
            </ol>
          )}
          {o.eta && !dead && (
            <p className="rounded-xl bg-sky-50 p-3 text-center text-sm text-sky-900">⏱ Estimated delivery: <b>{o.eta}</b>{o.zoneName ? ` · ${o.zoneName}` : ""}</p>
          )}
          {o.payment && o.payment !== "cod" && (
            <p className={`rounded-xl p-3 text-sm ${o.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-800" : o.paymentStatus === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
              Payment ({o.payment}): <b>{o.paymentStatus === "paid" ? "Received ✓" : o.paymentStatus === "failed" ? "Could not be verified" : o.paymentStatus === "pending" ? "Waiting for verification" : "Not paid yet"}</b>
            </p>
          )}
          {o.payment === "online" && o.paymentStatus !== "paid" && !dead && (
            <button type="button" className="btn-accent w-full py-3" onClick={payNow} disabled={payBusy}>{payBusy ? "Opening payment page…" : t("track.pay")}</button>
          )}
          {o.courierName && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-soft p-3.5 text-sm">
              <span>🚚 Shipped with <b>{o.courierName}</b>{o.trackingNo && <> · Tracking no. <b className="font-mono">{o.trackingNo}</b></>}</span>
              {o.courierUrl && <a href={o.courierUrl} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">Track shipment</a>}
            </div>
          )}
          <a href={`/invoice?no=${encodeURIComponent(o.orderNo)}&phone=${encodeURIComponent(phone.trim())}`} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">{t("track.invoice")}</a>
          {o.riderName && (
            <div className="rounded-xl bg-primary-soft p-3.5 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-primary/20">
                  {o.riderImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.riderImage} alt={o.riderName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">{o.riderName.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">{o.riderName}</p>
                  {(o.riderRatingAvg != null && o.riderRatingCount) ? (
                    <p className="text-xs text-amber-600">★ {o.riderRatingAvg.toFixed(1)} ({o.riderRatingCount} reviews)</p>
                  ) : (
                    <p className="text-xs text-gray-500">Your delivery rider</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.riderPhone && <a href={`tel:${o.riderPhone}`} className="btn-primary btn-sm">Call</a>}
                  {o.riderPhone && (
                    <a href={`https://wa.me/88${o.riderPhone.replace(/\D/g, "").slice(-11)}?text=${encodeURIComponent(`Hi, regarding order ${o.orderNo}`)}`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Chat</a>
                  )}
                </div>
              </div>
            </div>
          )}
          {onRoad && (pins.length ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-primary">📍 Live delivery tracking</span>
                {km !== null && <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-dark">{km < 0.05 ? "Your rider has arrived" : `${fmtDistance(km)} away · about ${roughEtaMin(km)} min`}</span>}
              </div>
              <LiveMap pins={pins} route height={280} />
              <p className="text-[11px] text-gray-400">
                {o.riderLoc ? `Updated ${o.riderLoc.ageSec < 10 ? "just now" : `${o.riderLoc.ageSec}s ago`} · refreshes automatically. ` : ""}
                {o.dest && <a className="font-medium text-primary" href={mapsDirections(o.dest)} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>}
              </p>
            </div>
          ) : <p className="rounded-xl bg-gray-50 p-3 text-center text-sm text-gray-500">🛵 Order is with the rider. Live location will appear when shared.</p>)}
          {stillCanCancel && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
              <span>Cancel within <b>{Math.floor(cancelSecsLeft / 60)}:{String(cancelSecsLeft % 60).padStart(2, "0")}</b></span>
              <button className="btn bg-red-600 text-white hover:bg-red-700 btn-sm" onClick={cancelOrder} disabled={cancelBusy}>{cancelBusy ? "Cancelling…" : t("track.cancel")}</button>
            </div>
          )}
          <ul className="divide-y rounded-xl border">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between p-3 text-sm">
                <span>{i.name} <span className="text-gray-500">× {i.qty}</span></span>
                <span className="font-semibold">{taka(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{taka(o.subtotal)}</span></div>
            {o.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−{taka(o.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>{taka(o.delivery)}</span></div>
            {(o.serviceCharge ?? 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Service charge</span><span>{taka(o.serviceCharge!)}</span></div>}
            <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="text-primary">{taka(o.total)}</span></div>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <button type="button" className="btn-outline btn-sm" onClick={reorder}>{t("track.reorder")}</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setShowIssue((v) => !v)}>Report issue</button>
          </div>

          {/* Rate rider after delivery */}
          {o.status === "delivered" && o.riderId && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              {o.rated || rateDone ? (
                <p className="text-sm font-semibold text-amber-900">
                  ✓ You rated this delivery{o.existingRating ? `: ${"★".repeat(o.existingRating.stars)}${"☆".repeat(5 - o.existingRating.stars)}` : ""}
                </p>
              ) : (
                <>
                  <p className="text-sm font-bold text-amber-900">Rate your rider</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setStars(n)} className={`text-2xl ${n <= stars ? "text-amber-500" : "text-gray-300"}`} aria-label={`${n} stars`}>★</button>
                    ))}
                  </div>
                  <textarea className="input mt-2" rows={2} placeholder="Optional comment…" value={rateComment} onChange={(e) => setRateComment(e.target.value)} />
                  <button type="button" className="btn-primary btn-sm mt-2" disabled={rateBusy} onClick={submitRating}>{rateBusy ? "Saving…" : "Submit rating"}</button>
                </>
              )}
            </div>
          )}

          {/* Report issue */}
          {showIssue && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-900">Report an issue</p>
              <textarea className="input mt-2" rows={3} required placeholder="Describe the problem…" value={issueText} onChange={(e) => setIssueText(e.target.value)} />
              <input type="file" accept="image/*" multiple className="input mt-2" onChange={(e) => setIssueFiles(e.target.files)} />
              <p className="mt-1 text-xs text-gray-500">You can attach up to 5 photos (optional).</p>
              <button type="button" className="btn bg-red-600 text-white hover:bg-red-700 btn-sm mt-2" disabled={issueBusy || !issueText.trim()} onClick={submitIssue}>{issueBusy ? "Sending…" : "Submit issue"}</button>
            </div>
          )}
          {issueMsg && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{issueMsg}</p>}

          {/* Existing issues */}
          {o.issues && o.issues.length > 0 && (
            <div className="rounded-xl border p-3">
              <p className="text-sm font-bold">Your reported issues</p>
              <ul className="mt-2 space-y-2">
                {o.issues.map((i) => (
                  <li key={i.id} className="rounded-lg bg-gray-50 p-2 text-sm">
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{i.status}</span>
                    <p className="mt-1">{i.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
