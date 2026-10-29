/**
 * Google Maps helpers.
 * - Links and the keyless iframe embed work with NO API key.
 * - The live interactive map (<LiveMap/>) uses the Maps JavaScript API when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set,
 *   and otherwise falls back to the keyless embed (a route/pin that refreshes as the rider moves).
 */
type Loc = { lat?: number; lng?: number; address?: string };
const has = (o: Loc) => typeof o.lat === "number" && typeof o.lng === "number";
const q = (o: Loc) => (has(o) ? `${o.lat},${o.lng}` : encodeURIComponent(o.address ?? ""));
/** open the place in Google Maps */
export const mapsView = (o: Loc) => `https://www.google.com/maps/search/?api=1&query=${q(o)}`;
/** turn-by-turn navigation from the person's current position */
export const mapsDirections = (o: Loc) => `https://www.google.com/maps/dir/?api=1&destination=${q(o)}&travelmode=driving`;
/** iframe src for an inline map */
export const mapsEmbed = (o: Loc) => `https://maps.google.com/maps?q=${q(o)}&z=${has(o) ? 16 : 14}&output=embed`;
/** iframe src showing the driving route between two points (keyless) */
export const mapsRouteEmbed = (from: Loc, to: Loc) => `https://maps.google.com/maps?saddr=${q(from)}&daddr=${q(to)}&dirflg=d&output=embed`;
export const hasPin = has;
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** straight-line distance in km (haversine) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}
/** "850 m" / "2.4 km" */
export const fmtDistance = (km: number) => (km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(1)} km`);
/** very rough minutes by road for a motorbike in city traffic (straight line × 1.4, ~20 km/h) */
export const roughEtaMin = (km: number) => Math.max(1, Math.round(((km * 1.4) / 20) * 60));
