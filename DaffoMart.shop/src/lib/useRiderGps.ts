"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { distanceKm } from "@/lib/maps";

export type GpsState = "off" | "starting" | "live" | "denied" | "unsupported" | "error";
export interface GpsPos { lat: number; lng: number; acc: number }

/**
 * Rider app GPS: while `enabled`, watches the phone's position, shows it to the rider and sends it to the server
 * (at most every 8 s, and only when he moved ≥ 10 m — or every 30 s as a heartbeat). Keeps the screen awake where the browser allows it.
 * Note: a web page cannot track in the background — the rider must keep this page open (screen on).
 */
export function useRiderGps(enabled: boolean) {
  const [state, setState] = useState<GpsState>("off"); const [pos, setPos] = useState<GpsPos | null>(null);
  const last = useRef<{ lat: number; lng: number; t: number } | null>(null); const sent = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setState("off"); setPos(null); last.current = null;
      if (sent.current) { sent.current = false; api("/api/rider/location", { method: "POST", body: { stop: true } }).catch(() => {}); }
      return;
    }
    if (!navigator.geolocation) { setState("unsupported"); return; }
    setState("starting");
    let wake: { release?: () => void } | null = null; let dead = false;
    const lock = async () => { try { const w = await (navigator as any).wakeLock?.request("screen"); if (dead) w?.release?.(); else wake = w; } catch { /* not supported / battery saver */ } };
    const vis = () => { if (document.visibilityState === "visible") lock(); };
    lock(); document.addEventListener("visibilitychange", vis);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude }; setPos({ ...c, acc: p.coords.accuracy }); setState("live");
        const now = Date.now(), l = last.current;
        if (!l || (now - l.t > 8000 && (distanceKm(l, c) > 0.01 || now - l.t > 30_000))) {
          last.current = { ...c, t: now }; sent.current = true;
          api("/api/rider/location", { method: "POST", body: c }).catch(() => {});
        }
      },
      (e) => setState(e.code === 1 ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 });
    return () => { dead = true; navigator.geolocation.clearWatch(id); document.removeEventListener("visibilitychange", vis); wake?.release?.(); };
  }, [enabled]);

  return { state, pos };
}
