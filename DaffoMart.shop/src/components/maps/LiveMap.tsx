"use client";
import { useEffect, useRef, useState } from "react";
import { MAPS_KEY, mapsEmbed, mapsRouteEmbed, distanceKm } from "@/lib/maps";

export type Pin = { id: string; lat: number; lng: number; kind: "rider" | "home" | "me" | "shop"; label?: string };
const ICON: Record<Pin["kind"], { emoji: string; bg: string }> = { rider: { emoji: "🛵", bg: "#F7941D" }, home: { emoji: "🏠", bg: "#1E3A8A" }, me: { emoji: "📍", bg: "#2563EB" }, shop: { emoji: "🏪", bg: "#059669" } };

/* ---- load the Maps JavaScript API once ---- */
let loader: Promise<any> | null = null;
function loadGoogle(key: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  loader ??= new Promise((res, rej) => {
    w.__dmMapsReady = () => res(w.google);
    w.gm_authFailure = () => window.dispatchEvent(new Event("dm-maps-auth-failed")); // bad / restricted key
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__dmMapsReady&v=weekly`;
    s.async = true; s.onerror = () => { loader = null; rej(new Error("Google Maps failed to load")); };
    document.head.appendChild(s);
  });
  return loader;
}
const icon = (g: any, kind: Pin["kind"]) => {
  const { emoji, bg } = ICON[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52"><path d="M22 51S3 33 3 20a19 19 0 0 1 38 0c0 13-19 31-19 31z" fill="${bg}" stroke="#fff" stroke-width="3"/><text x="22" y="27" font-size="17" text-anchor="middle">${emoji}</text></svg>`;
  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new g.maps.Size(40, 47), anchor: new g.maps.Point(20, 47) };
};

/**
 * Live map. With NEXT_PUBLIC_GOOGLE_MAPS_API_KEY → interactive Google map (markers move as `pins` change, optional road route).
 * Without a key (or if Google rejects it) → keyless embed: a route between the mover and the destination, or a single pin.
 * Pass `route` to draw the way from the rider/me pin to the home pin.
 */
export default function LiveMap({ pins, route = false, height = 260, className = "" }: { pins: Pin[]; route?: boolean; height?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const S = useRef<{ map?: any; g?: any; markers: Map<string, any>; line?: any; dir?: any; dirAt: number; dirFrom?: Pin; noDir: boolean; moved: boolean; ids: string }>({ markers: new Map(), dirAt: 0, noDir: false, moved: false, ids: "" });
  const [failed, setFailed] = useState(!MAPS_KEY); const [ready, setReady] = useState(false); const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!MAPS_KEY) return;
    const bad = () => setFailed(true); window.addEventListener("dm-maps-auth-failed", bad);
    let dead = false;
    loadGoogle(MAPS_KEY).then((g) => {
      if (dead || !box.current || S.current.map) return;
      S.current.g = g;
      S.current.map = new g.maps.Map(box.current, { center: { lat: 23.8103, lng: 90.4125 }, zoom: 13, disableDefaultUI: true, zoomControl: true, fullscreenControl: true, gestureHandling: "greedy", clickableIcons: false });
      S.current.map.addListener("dragstart", () => { S.current.moved = true; });
      setReady(true);
    }).catch(bad);
    return () => { dead = true; window.removeEventListener("dm-maps-auth-failed", bad); };
  }, []);

  useEffect(() => {
    const s = S.current; if (!ready || failed || !s.map || !s.g) return; const g = s.g;
    // markers: create / move / remove
    const seen = new Set<string>();
    for (const p of pins) {
      seen.add(p.id); const pos = { lat: p.lat, lng: p.lng }; const m = s.markers.get(p.id);
      if (m) { m.setPosition(pos); m.setTitle(p.label ?? ""); }
      else s.markers.set(p.id, new g.maps.Marker({ map: s.map, position: pos, icon: icon(g, p.kind), title: p.label ?? "", zIndex: p.kind === "rider" ? 3 : p.kind === "me" ? 2 : 1 }));
    }
    for (const [id, m] of s.markers) if (!seen.has(id)) { m.setMap(null); s.markers.delete(id); }

    // route from the mover (rider / me) to the customer
    const from = pins.find((p) => p.kind === "rider" || p.kind === "me"), to = pins.find((p) => p.kind === "home");
    if (route && from && to) {
      const path = [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }];
      if (!s.line) s.line = new g.maps.Polyline({ map: s.map, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, strokeColor: "#1E3A8A", scale: 3 }, offset: "0", repeat: "14px" }] });
      s.line.setPath(path);
      const now = Date.now(), moved = !s.dirFrom || distanceKm(s.dirFrom, from) > 0.05;
      if (!s.noDir && moved && now - s.dirAt > 30_000) {
        s.dirAt = now; s.dirFrom = from;
        new g.maps.DirectionsService().route({ origin: path[0], destination: path[1], travelMode: "DRIVING" }, (res: any, st: string) => {
          if (st === "OK") { s.dir ??= new g.maps.DirectionsRenderer({ map: s.map, suppressMarkers: true, preserveViewport: true, polylineOptions: { strokeColor: "#1E3A8A", strokeWeight: 5, strokeOpacity: 0.75 } }); s.dir.setDirections(res); s.line?.setMap(null); }
          else if (st === "REQUEST_DENIED") s.noDir = true; // Directions API not enabled: keep the dashed straight line
        });
      }
    } else { s.line?.setMap(null); s.line = undefined; s.dir?.setMap(null); s.dir = undefined; s.dirFrom = undefined; }

    // framing: fit everything on first draw / when the set of pins changes, or while the user has not panned
    const ids = pins.map((p) => p.id).sort().join(",");
    if (pins.length && (ids !== s.ids || !s.moved)) {
      s.ids = ids;
      if (pins.length === 1) { s.map.setCenter({ lat: pins[0].lat, lng: pins[0].lng }); s.map.setZoom(16); }
      else { const b = new g.maps.LatLngBounds(); pins.forEach((p) => b.extend({ lat: p.lat, lng: p.lng })); s.map.fitBounds(b, 56); }
    }
  }, [pins, route, ready, failed, tick]);

  const recenter = () => { S.current.moved = false; S.current.ids = ""; setTick((t) => t + 1); }; // re-runs the framing step above

  if (failed) {
    const mover = pins.find((p) => p.kind === "rider" || p.kind === "me"), dest = pins.find((p) => p.kind === "home"), first = pins[0];
    const src = route && mover && dest ? mapsRouteEmbed(mover, dest) : first ? mapsEmbed(first) : "";
    return src ? <iframe title="Map" src={src} style={{ height }} className={`w-full rounded-xl border-0 ${className}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div style={{ height }} className={`flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 ${className}`}>Location not available yet</div>;
  }
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gray-100 ${className}`} style={{ height }}>
      <div ref={box} className="h-full w-full" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Loading map…</div>}
      {ready && pins.length > 1 && <button type="button" onClick={recenter} className="absolute bottom-2 left-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-primary shadow-card">⤢ Show all</button>}
    </div>
  );
}
