import type { StoreSettings } from "@/lib/types";

/**
 * One icon set for social links, contact methods and payment methods.
 * - If the admin uploaded an image for the key (Admin → Settings → Icons), that image is used.
 * - Otherwise a built-in vector icon is drawn (no external files, no emoji).
 * Server-safe: no hooks, no browser APIs.
 */
export type IconKey = "facebook" | "instagram" | "youtube" | "tiktok" | "whatsapp" | "phone" | "email" | "address" | "cod" | "online" | "card" | string;

export const ICON_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", whatsapp: "WhatsApp", phone: "Call", email: "Email", address: "Address", cod: "Cash on delivery", online: "Online payment", bkash: "bKash", nagad: "Nagad" };
/** brand colours used behind the built-in icons */
export const ICON_COLOR: Record<string, string> = { facebook: "#1877F2", instagram: "#D62976", youtube: "#FF0000", tiktok: "#111111", whatsapp: "#25D366", phone: "#0F766E", email: "#475569", address: "#DC2626", cod: "#15803D", online: "#2563EB", card: "#2563EB", bkash: "#E2136E", nagad: "#F6921E" };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function Glyph({ k }: { k: string }) {
  switch (k) {
    case "facebook": return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z" /></svg>;
    case "instagram": return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".6" fill="currentColor" /></svg>;
    case "youtube": return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" /></svg>;
    case "tiktok": return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.6 3a4.6 4.6 0 0 0 3.4 3.9v3a7.6 7.6 0 0 1-3.4-.9v6.2a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.8 2.5V3z" /></svg>;
    case "whatsapp": return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" /><path d="M9 8.8c.2 2.6 3.6 5.9 6.2 6.2l1-1.2-2-1-.8.7c-.9-.4-1.9-1.4-2.3-2.3l.7-.8-1-2z" fill="currentColor" stroke="none" /></svg>;
    case "phone": return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" /></svg>;
    case "email": return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>;
    case "address": return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case "cod": return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></svg>;
    case "bkash": return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 8.5 12 3l8 5.5-3.2 12.5L12 17l-4.8 4z" opacity=".95" /></svg>;
    case "nagad": return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="12" r="9" opacity=".95" /><path d="M8 15.5V8.5l8 7v-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    default: return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></svg>; // card / online / custom method
  }
}

/** Round (or rounded-square) icon. `size` is a Tailwind size class pair such as "h-10 w-10". */
export default function BrandIcon({ k, settings, size = "h-10 w-10", label, plain = false }: { k: IconKey; settings?: Partial<StoreSettings>; size?: string; label?: string; plain?: boolean }) {
  const img = settings?.iconImages?.[k];
  const alt = label || ICON_LABEL[k] || k;
  if (img) return (
    // eslint-disable-next-line @next/next/no-img-element
    <span className={`inline-flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5`}><img src={img} alt={alt} className="h-full w-full object-contain p-1" loading="lazy" decoding="async" /></span>
  );
  const bg = ICON_COLOR[k] || "#2563EB";
  return (
    <span role="img" aria-label={alt} className={`inline-flex ${size} shrink-0 items-center justify-center rounded-xl shadow-sm ${plain ? "" : "text-white"}`} style={plain ? { color: bg } : { background: bg }}>
      <span className="block h-[55%] w-[55%]"><Glyph k={k} /></span>
    </span>
  );
}
