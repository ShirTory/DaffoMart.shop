"use client";
import { useEffect, useMemo } from "react";
import { Empty, ErrorBox, PageHeader, PageLoader, StatusBadge, useList } from "@/components/admin/ui";
import LiveMap, { type Pin } from "@/components/maps/LiveMap";
import { hasPin } from "@/lib/maps";
import { statusLabel } from "@/lib/format";
import { riderApproved } from "@/lib/rider";
import type { Order, Rider } from "@/lib/types";

const LIVE = new Set(["assigned", "picked_up", "on_the_way"]);
const age = (iso?: string) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)) : null);
const ago = (s: number) => (s < 15 ? "just now" : s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : "a while ago");

export default function LiveMapPage() {
  const riders = useList<Rider[]>("/api/riders"); const orders = useList<Order[]>("/api/orders");
  useEffect(() => { const t = setInterval(() => { riders.reload(); orders.reload(); }, 10_000); return () => clearInterval(t); }, [riders.reload, orders.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const { pins, rows, jobs } = useMemo(() => {
    const act = (orders.data ?? []).filter((o) => LIVE.has(o.status));
    const rows = (riders.data ?? []).filter((r) => r.active && riderApproved(r)).map((r) => {
      const a = age(r.locAt); const fresh = a !== null && a < 900 && typeof r.lat === "number";
      return { r, a, fresh, jobs: act.filter((o) => o.riderId === r.id) };
    }).sort((x, y) => Number(y.fresh) - Number(x.fresh) || y.jobs.length - x.jobs.length);
    const pins: Pin[] = [
      ...rows.filter((x) => x.fresh).map((x) => ({ id: `r${x.r.id}`, kind: "rider" as const, lat: x.r.lat!, lng: x.r.lng!, label: `${x.r.name} (${x.jobs.length} active)` })),
      ...act.filter((o) => hasPin(o)).map((o) => ({ id: `o${o.id}`, kind: "home" as const, lat: o.lat!, lng: o.lng!, label: `${o.orderNo} · ${o.name}` })),
    ];
    return { pins, rows, jobs: act };
  }, [riders.data, orders.data]);

  if (riders.loading || orders.loading) return <PageLoader />;
  if (riders.error || orders.error) return <ErrorBox msg={riders.error || orders.error} retry={() => { riders.reload(); orders.reload(); }} />;
  return (
    <>
      <PageHeader title="Live map" subtitle="Riders who are sharing their location, and the customers they are delivering to · refreshes every 10 seconds" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="card p-3">
          {pins.length ? <LiveMap pins={pins} height={540} /> : <Empty icon="rider" title="Nothing to show yet" hint="Riders appear here when they switch on “Share live location” in the rider app. Customers appear when an order with a GPS pin is assigned." />}
          <p className="mt-2 px-1 text-xs text-gray-500">🛵 rider · 🏠 customer drop-off (customers who shared their location at checkout)</p>
        </div>
        <div className="card divide-y">
          <p className="p-4 text-sm font-bold">Riders ({rows.length})</p>
          {!rows.length && <p className="p-4 text-sm text-gray-500">No active riders. Add them in Riders.</p>}
          {rows.map(({ r, a, fresh, jobs: j }) => (
            <div key={r.id} className="space-y-1 p-4 text-sm">
              <div className="flex items-center justify-between gap-2"><b className="truncate">{r.name}</b><StatusBadge status={fresh ? "active" : "inactive"} label={fresh ? "Live" : a !== null ? "Last seen " + ago(a) : "Offline"} /></div>
              <a href={`tel:${r.phone}`} className="text-xs text-primary">{r.phone}</a>
              {j.length ? j.map((o) => <p key={o.id} className="text-xs text-gray-600">{o.orderNo} · {o.name} · <span className="font-medium">{statusLabel(o.status)}</span></p>) : <p className="text-xs text-gray-400">No active delivery</p>}
              {j.length > 0 && !fresh && <p className="text-xs font-medium text-amber-700">⚠ Delivering but not sharing location</p>}
            </div>))}
          {jobs.length > 0 && <p className="p-4 text-xs text-gray-500">{jobs.length} delivery(ies) in progress · {jobs.filter((o) => !hasPin(o)).length} without a customer GPS pin</p>}
        </div>
      </div>
    </>
  );
}
