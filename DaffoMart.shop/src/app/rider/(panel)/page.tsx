"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Icon, PageLoader, Spinner, ToastProvider, useToast } from "@/components/admin/ui";
import { fmtDateTime, statusLabel, taka } from "@/lib/format";
import { distanceKm, fmtDistance, hasPin, mapsDirections, mapsEmbed, mapsView } from "@/lib/maps";
import { useRiderGps } from "@/lib/useRiderGps";
import LiveMap, { type Pin } from "@/components/maps/LiveMap";
import { PAYMENT_LABEL, type Order } from "@/lib/types";

interface Me { id: string; name: string; phone: string; vehicle: string; area: string; image?: string; ratingAvg?: number; ratingCount?: number }
interface Data { active: Order[]; recent: Order[] }
interface Att { status: string; checkIn?: string; checkOut?: string }
const NEXT: Record<string, { to: string; label: string } | undefined> = {
  assigned: { to: "picked_up", label: "✅ Picked up order" }, picked_up: { to: "on_the_way", label: "🛵 Start delivery" }, on_the_way: { to: "delivered", label: "📦 Mark delivered" },
};
const ON_ROAD = new Set(["picked_up", "on_the_way"]);
const GPS_TEXT: Record<string, string> = { off: "Off — customers cannot see you on the map", starting: "Getting your GPS position…", live: "Live — customers with your parcel can see you", denied: "Location permission blocked — allow it in the browser settings", unsupported: "This phone/browser cannot share location", error: "Could not read GPS — check that location is turned on" };
const collect = (o: Order) => (o.payment === "cod" && o.paymentStatus !== "paid" ? o.total : 0);

function Dashboard() {
  const toast = useToast(); const router = useRouter();
  const [me, setMe] = useState<Me | null>(null); const [data, setData] = useState<Data | null>(null); const [tab, setTab] = useState<"active" | "map" | "done">("active");
  const [att, setAtt] = useState<Att | null>(null); const [attBusy, setAttBusy] = useState(false);
  useEffect(() => { api<{ today: Att | null }>("/api/rider/attendance").then((r) => setAtt(r.today)).catch(() => {}); }, []);
  const punch = async (action: "in" | "out") => { setAttBusy(true); setErr(""); try { setAtt(await api<Att>("/api/rider/attendance", { method: "POST", body: { action } })); } catch (e: any) { setErr(e.message); } finally { setAttBusy(false); } };
  const [share, setShare] = useState(false);
  const [issueFor, setIssueFor] = useState<string | null>(null); const [issueText, setIssueText] = useState(""); const [issueFiles, setIssueFiles] = useState<FileList | null>(null); const [issueBusy, setIssueBusy] = useState(false); const gps = useRiderGps(share);
  useEffect(() => { try { setShare(localStorage.getItem("dm-rider-gps") === "1"); } catch { /* private mode */ } }, []);
  const setSharing = (v: boolean) => { setShare(v); try { localStorage.setItem("dm-rider-gps", v ? "1" : "0"); } catch { /* ignore */ } };
  const [busy, setBusy] = useState(""); const [open, setOpen] = useState<string | null>(null); const [err, setErr] = useState("");
  const load = useCallback(async () => { try { setData(await api<Data>("/api/rider/orders")); setErr(""); } catch (e: any) { setErr(e.message); } }, []);
  useEffect(() => { api<Me>("/api/rider/me").then(setMe).catch(() => {}); load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  
  const reportIssue = async (o: Order) => {
    if (!issueText.trim()) return toast("Describe the issue", "err");
    setIssueBusy(true);
    try {
      const fd = new FormData();
      fd.append("orderId", o.id);
      fd.append("raisedBy", "rider");
      fd.append("text", issueText.trim());
      fd.append("raiserName", me?.name || "");
      fd.append("raiserPhone", me?.phone || "");
      if (issueFiles) for (let i = 0; i < Math.min(issueFiles.length, 5); i++) fd.append("photos", issueFiles[i]);
      const res = await fetch("/api/issues", { method: "POST", body: fd, credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not submit");
      toast("Issue reported to admin");
      setIssueFor(null); setIssueText(""); setIssueFiles(null);
    } catch (e: any) { toast(e.message, "err"); }
    finally { setIssueBusy(false); }
  };
  const step = async (o: Order, status: string) => {
    setBusy(o.id);
    try { await api(`/api/rider/orders/${o.id}`, { method: "PATCH", body: { status } }); if (status === "on_the_way" && !share) { setSharing(true); toast("Live location sharing is ON so the customer can follow you"); } else toast(status === "delivered" ? "Delivered. Great job!" : "Status updated"); await load(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(""); }
  };
  const fail = async (o: Order) => { if (window.confirm(`Mark ${o.orderNo} as returned / delivery failed?`)) step(o, "returned"); };
  const logout = async () => { setSharing(false); await api("/api/rider/logout", { method: "POST" }).catch(() => {}); router.replace("/rider/login"); router.refresh(); };

  const today = new Date().toDateString();
  const doneToday = data?.recent.filter((o) => o.status === "delivered" && new Date(o.updatedAt).toDateString() === today) ?? [];
  const toCollect = data?.active.reduce((n, o) => n + collect(o), 0) ?? 0;
  const collectedToday = doneToday.filter((o) => o.payment === "cod").reduce((n, o) => n + o.total, 0);
  const list = tab === "done" ? data?.recent : data?.active;
  const here = gps.pos ? { lat: gps.pos.lat, lng: gps.pos.lng } : null;
  const away = (o: Order) => (here && hasPin(o) ? distanceKm(here, o as { lat: number; lng: number }) : null);
  const mapPins: Pin[] = [...(here ? [{ id: "me", kind: "me" as const, lat: here.lat, lng: here.lng, label: "You" }] : []), ...(data?.active ?? []).filter((o) => hasPin(o)).map((o) => ({ id: o.id, kind: "home" as const, lat: o.lat!, lng: o.lng!, label: `${o.orderNo} · ${o.name}` }))];
  const noPin = (data?.active ?? []).filter((o) => !hasPin(o));

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-gray-100 pb-10">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-primary-deeper px-4 py-3 text-white">
        <div><p className="text-xs text-white/60">Rider dashboard</p><p className="font-bold">{me?.name ?? "…"}</p></div>
        <div className="flex gap-2"><a href="/rider/earnings" className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold">৳ Earnings</a><button onClick={load} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold">↻ Refresh</button><button onClick={logout} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold"><Icon name="out" className="inline h-4 w-4" /> Sign out</button></div>
      </header>

      <div className={`mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl p-3 text-sm shadow-card ${share && gps.state === "live" ? "bg-emerald-50" : gps.state === "denied" || gps.state === "error" || gps.state === "unsupported" ? "bg-red-50" : "bg-white"}`}>
        <div className="min-w-0"><p className="font-bold">{share && gps.state === "live" ? "🟢 " : "📡 "}Share live location</p><p className="text-xs text-gray-600">{GPS_TEXT[gps.state]}</p>{share && <p className="mt-0.5 text-[11px] text-gray-400">Keep this page open with the screen on — phones pause GPS in the background.</p>}</div>
        <button onClick={() => setSharing(!share)} role="switch" aria-checked={share} className={`relative h-7 w-12 shrink-0 rounded-full transition ${share ? "bg-emerald-500" : "bg-gray-300"}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${share ? "left-[22px]" : "left-0.5"}`} /></button>
      </div>

      <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-white p-3 shadow-card">
        <label className="relative cursor-pointer">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xl font-bold text-primary ring-2 ring-primary/20">
            {me?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.image} alt="" className="h-full w-full object-cover" />
            ) : (me?.name?.charAt(0)?.toUpperCase() || "?")}
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f || !me) return;
            const fd = new FormData(); fd.append("image", f);
            try {
              const res = await fetch("/api/rider/me", { method: "PATCH", body: fd, credentials: "same-origin" });
              const json = await res.json();
              if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload failed");
              setMe(json.data); toast("Photo updated");
            } catch (err: any) { setErr(err.message); }
          }} />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary px-1 text-[9px] font-bold text-white">Edit</span>
        </label>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900">{me?.name}</p>
          <p className="text-xs text-gray-500">{me?.phone}{me?.vehicle ? ` · ${me.vehicle}` : ""}</p>
          {me?.ratingCount ? <p className="text-xs font-semibold text-amber-600">★ {Number(me.ratingAvg).toFixed(1)} · {me.ratingCount} ratings</p> : null}
        </div>
      </div>

<div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm shadow-card">
        <div className="min-w-0"><p className="font-bold">🕘 Today&apos;s attendance</p><p className="text-xs text-gray-600">{!att?.checkIn ? "Not checked in yet" : att.checkOut ? `In ${att.checkIn} · Out ${att.checkOut}` : `Checked in at ${att.checkIn}${att.status === "late" ? " (late)" : ""}`}</p></div>
        {!att?.checkIn ? <button className="btn-primary btn-sm shrink-0" disabled={attBusy} onClick={() => punch("in")}>Check in</button> : !att.checkOut ? <button className="btn-outline btn-sm shrink-0" disabled={attBusy} onClick={() => punch("out")}>Check out</button> : <span className="shrink-0 text-xl">✅</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3 text-center">
        {[["Active", String(data?.active.length ?? 0), "text-primary"], ["Delivered today", String(doneToday.length), "text-emerald-600"], ["Cash to collect", taka(toCollect), "text-accent-dark"]].map(([l, v, c]) => (
          <div key={l} className="rounded-xl bg-white p-3 shadow-card"><p className={`text-lg font-extrabold ${c}`}>{v}</p><p className="text-[11px] font-medium text-gray-500">{l}</p></div>))}
      </div>
      {collectedToday > 0 && <p className="mx-3 mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Cash collected today: <b>{taka(collectedToday)}</b> — hand it over to the store.</p>}

      <div className="mx-3 flex gap-1 rounded-lg bg-gray-200 p-1 text-sm font-semibold">{([["active", "My deliveries"], ["map", "🗺 Map"], ["done", "Completed"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-md py-2 ${tab === k ? "bg-white text-primary shadow-sm" : "text-gray-600"}`}>{l}</button>)}</div>

      <div className="mt-3 space-y-3 px-3">
        {err && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        {tab === "map" && data && (
          <div className="space-y-3 rounded-2xl bg-white p-3 shadow-card">
            {mapPins.length ? <LiveMap pins={mapPins} height={340} /> : <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500"><p className="text-3xl">🗺</p><p className="mt-2">{share ? "Waiting for your GPS position and customer locations…" : "Turn on “Share live location” to see yourself on the map."}</p></div>}
            <ul className="divide-y text-sm">{(data.active ?? []).map((o) => { const d = away(o); return (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0"><b className="text-primary">{o.orderNo}</b> · {o.name}<span className="block truncate text-xs text-gray-500">{o.address}</span></span>
                <span className="shrink-0 text-right text-xs">{d !== null ? <b className="text-accent-dark">{fmtDistance(d)}</b> : hasPin(o) ? "" : <span className="text-gray-400">no pin</span>}<a className="ml-2 font-semibold text-blue-600" href={mapsDirections(o)} target="_blank" rel="noopener noreferrer">Navigate</a></span></li>); })}</ul>
            {noPin.length > 0 && <p className="text-xs text-gray-400">{noPin.length} order(s) have no GPS pin (customer typed the address only) — use Navigate or call the customer.</p>}
          </div>)}
        {tab === "map" ? null : !data ? <PageLoader /> : !list?.length ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500 shadow-card"><p className="text-4xl">{tab === "active" ? "😴" : "📋"}</p><p className="mt-2 font-semibold text-gray-700">{tab === "active" ? "No deliveries assigned right now" : "Nothing completed yet"}</p><p>{tab === "active" ? "New orders appear here automatically." : ""}</p></div> :
          list.map((o) => { const nx = NEXT[o.status]; const isOpen = open === o.id; const c = collect(o); return (
            <article key={o.id} className="overflow-hidden rounded-2xl bg-white shadow-card">
              <button className="flex w-full items-start justify-between gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : o.id)}>
                <div className="min-w-0"><p className="font-extrabold text-primary">{o.orderNo}</p><p className="font-semibold">{o.name}</p><p className="line-clamp-2 text-sm text-gray-600">{o.address}</p>{o.zoneName && <p className="mt-0.5 text-xs text-gray-400">{o.zoneName}</p>}{away(o) !== null && <p className="mt-0.5 text-xs font-semibold text-accent-dark">📍 {fmtDistance(away(o)!)} from you</p>}</div>
                <div className="shrink-0 text-right"><span className="badge bg-indigo-100 text-indigo-800">{statusLabel(o.status)}</span><p className="mt-2 text-lg font-extrabold">{taka(o.total)}</p>
                  <p className={`text-[11px] font-bold ${c ? "text-accent-dark" : "text-emerald-600"}`}>{c ? "COLLECT CASH" : o.paymentStatus === "paid" || o.payment !== "cod" ? "PAID" : ""}</p></div>
              </button>
              <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                <a href={`tel:${o.phone}`} className="btn-outline justify-center"><Icon name="phone" className="h-4 w-4" />Call customer</a>
                <a href={mapsDirections(o)} target="_blank" rel="noopener noreferrer" className="btn bg-blue-600 text-white hover:bg-blue-700">🧭 Navigate</a>
              </div>
              {isOpen && (
                <div className="space-y-3 border-t bg-gray-50 p-4 text-sm">
                  {hasPin(o) ? <LiveMap route height={220} pins={[...(here ? [{ id: "me", kind: "me" as const, lat: here.lat, lng: here.lng, label: "You" }] : []), ...(hasPin(o) ? [{ id: "home", kind: "home" as const, lat: o.lat!, lng: o.lng!, label: o.name }] : [])]} /> : <iframe title="Map" src={mapsEmbed(o)} className="h-48 w-full rounded-xl border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
                  <p className="text-xs text-gray-500">{hasPin(o) ? "Exact location shared by the customer." : "Location is searched from the address — confirm by phone if unsure."} <a className="font-semibold text-primary" href={mapsView(o)} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>
                  {o.note && <p className="rounded-lg bg-amber-50 p-2.5 text-amber-900"><b>Note:</b> {o.note}</p>}
                  <ul className="divide-y rounded-xl bg-white">{o.items.map((i) => <li key={i.id} className="flex justify-between p-2.5"><span>{i.name} <span className="text-gray-500">× {i.qty}</span></span><span className="font-semibold">{taka(i.price * i.qty)}</span></li>)}</ul>
                  <p className="text-xs text-gray-500">{o.paymentLabel ?? PAYMENT_LABEL[o.payment] ?? o.payment} · {o.paymentStatus === "paid" ? "Paid" : o.payment === "cod" ? "Cash due on delivery" : "Payment not confirmed"} · Ordered {fmtDateTime(o.createdAt)}</p>
                  <button type="button" className="btn-outline btn-sm w-full text-red-600" onClick={() => setIssueFor(issueFor === o.id ? null : o.id)}>Report issue on this order</button>
                  {issueFor === o.id && (
                    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                      <textarea className="input" rows={2} placeholder="What went wrong?" value={issueText} onChange={(e) => setIssueText(e.target.value)} />
                      <input type="file" accept="image/*" multiple className="input" onChange={(e) => setIssueFiles(e.target.files)} />
                      <button type="button" className="btn bg-red-600 text-white hover:bg-red-700 btn-sm w-full" disabled={issueBusy} onClick={() => reportIssue(o)}>{issueBusy ? "Sending…" : "Submit issue"}</button>
                    </div>
                  )}
                </div>)}
              {(nx || ["assigned", "picked_up", "on_the_way"].includes(o.status)) && (
                <div className="flex gap-2 border-t p-3">
                  {nx && <button className="btn-accent flex-1 py-3 text-base" disabled={busy === o.id} onClick={() => step(o, nx.to)}>{busy === o.id ? <Spinner className="h-4 w-4" /> : null}{nx.label}</button>}
                  <button className="btn-outline px-3 text-red-600" disabled={busy === o.id} onClick={() => fail(o)} title="Delivery failed / returned">✕</button>
                </div>)}
            </article>); })}
      </div>
    </div>
  );
}
export default function RiderPage() { return <ToastProvider><Dashboard /></ToastProvider>; }
