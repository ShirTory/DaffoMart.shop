"use client";
import type { StoreSettings } from "@/lib/types";
import { validHex } from "@/lib/theme";
import BrandIcon from "./BrandIcon";

/**
 * Floating Call / WhatsApp controls.
 * - Mobile: bottom offset clears BottomNav (~4rem) + iOS safe-area.
 * - Desktop (md+): lower corner, no bottom-nav.
 * - z-30: above page content, below modals/drawers.
 * - min 44px touch targets; icon-only on very small screens.
 * Contacts come from Admin settings (phone / whatsapp) — not hard-coded.
 */
export default function SupportButtons({ settings }: { settings: StoreSettings }) {
  const phone = (settings.phone || "").replace(/[^\d+]/g, "");
  const wa = (settings.whatsapp || "").replace(/\D/g, "");
  const showCall = settings.showSupportCall !== false && phone.length >= 5;
  const showWa = settings.showSupportWa !== false && wa.length >= 8;
  if (!showCall && !showWa) return null;

  const callLabel = settings.supportCallLabel || "Call Now";
  const waLabel = settings.supportWaLabel || "WhatsApp";
  const waMsg = encodeURIComponent(
    settings.supportWaMessage || `Hi ${settings.storeName}, I need help with my order.`
  );
  const side =
    settings.supportPosition === "left"
      ? "left-3 sm:left-4 items-start"
      : "right-3 sm:right-4 items-end";

  return (
    <div
      className={`fixed z-30 flex flex-col gap-2.5 ${side} bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]`}
      role="complementary"
      aria-label="Customer support"
    >
      {showWa && (
        <a
          href={`https://wa.me/${wa}?text=${waMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={waLabel}
          className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-bold text-white shadow-lg transition hover:scale-105 active:scale-95 sm:h-auto sm:py-2.5"
          style={{ background: validHex(settings.supportWaColor) || "#25D366" }}
        >
          {settings.iconImages?.whatsapp ? <BrandIcon k="whatsapp" settings={settings} size="h-7 w-7" /> : <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" /></svg>}
          <span className="hidden sm:inline">{waLabel}</span>
        </a>
      )}
      {showCall && (
        <a
          href={`tel:${phone}`}
          aria-label={callLabel}
          className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-bold text-white shadow-lg transition hover:scale-105 active:scale-95 sm:h-auto sm:py-2.5"
          style={{ background: validHex(settings.supportCallColor) || "rgb(var(--c-primary))" }}
        >
          {settings.iconImages?.phone ? <BrandIcon k="phone" settings={settings} size="h-7 w-7" /> : <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" /></svg>}
          <span className="hidden sm:inline">{callLabel}</span>
        </a>
      )}
    </div>
  );
}
