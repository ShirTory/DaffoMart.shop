import Link from "next/link";
import type { StoreSettings } from "@/lib/types";
import { btnLookProps } from "@/lib/btnLook";
import { readableOn, validHex } from "@/lib/theme";

const PILL = "M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7l-10 10zM8.5 8.5l7 7";

/**
 * Highlighted "Medicine" entry for the home page (the category strip is hidden on phones, so there was no way in).
 * Admin → Appearance → Medicine button: on/off, phones only or everywhere, banner or single button, texts, colours and the full button designer.
 */
export default function MedicineCta({ settings: s }: { settings: StoreSettings }) {
  if (!s.showMedicine || s.medCtaShow === false) return null;
  const title = s.medCtaTitle || s.medicineTitle || "Medicine & Healthcare";
  const sub = s.medCtaSubtitle ?? "Genuine medicines & health products, delivered fast";
  const label = s.medCtaLabel || "Order medicine";
  const c1 = validHex(s.medCtaBg) || "#047857"; const c2 = validHex(s.medCtaBg2) || "#10B981";
  const fg = validHex(s.medCtaText) || readableOn(c1);
  const vis = s.medCtaDevices === "all" ? "" : "md:hidden";
  const btn = btnLookProps(s.medCtaBtn, { style: "solid", bg: "#FFFFFF", color: c1, anim: "shine", size: "sm", weight: "bold", radius: "full" });

  if (s.medCtaStyle === "button") {
    const b = btnLookProps(s.medCtaBtn, { style: "solid", bg: c1, color: "#FFFFFF", anim: "shine", size: "lg", weight: "bold", radius: "lg", shadow: "soft" });
    return (
      <div className={`mt-4 ${vis}`}>
        <Link href="/medicine" className={`${b.className} w-full`} style={b.style}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={PILL} /></svg>
          {label}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
      </div>
    );
  }
  return (
    <div className={`mt-4 ${vis}`}>
      <Link href="/medicine" aria-label={title} className="group relative flex items-center gap-3 overflow-hidden rounded-2xl p-3.5 shadow-md ring-1 ring-black/5 transition active:scale-[.99]" style={{ background: `linear-gradient(120deg, ${c1}, ${c2})`, color: fg }}>
        <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={PILL} /></svg>
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold leading-tight">{title}</span>
          {sub && <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug opacity-90">{sub}</span>}
        </span>
        <span className={`relative shrink-0 ${btn.className}`} style={btn.style}>{label}<svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
      </Link>
    </div>
  );
}
