"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoreSettings } from "@/lib/types";
import { readableOn, validHex } from "@/lib/theme";

const SIZE = { sm: "py-1 text-[11px] sm:text-xs", md: "py-1.5 text-xs sm:text-[13px]", lg: "py-2.5 text-sm sm:text-base" } as const;

/** Small hash so a changed message shows again even if an older one was dismissed. */
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

function Megaphone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/**
 * Top announcement strip. It always uses a colour that differs from the header (accent colour on a dark header, deep brand colour on a light one),
 * with automatically readable text. Admin → Appearance → Announcement bar controls colours, icon, link, size, scrolling and the close button.
 */
export default function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  const text = (settings.announcement || "").trim();
  const key = `ann-closed:${hash(text)}`;
  const [closed, setClosed] = useState(false);
  useEffect(() => { try { if (settings.announcementDismissible && sessionStorage.getItem(key)) setClosed(true); } catch { /* storage blocked */ } }, [key, settings.announcementDismissible]);
  if (!text || closed) return null;

  const brandHeader = settings.headerTheme === "brand" && !validHex(settings.headerBg);
  const bg = validHex(settings.announcementBg) || (brandHeader ? "rgb(var(--c-accent))" : "rgb(var(--c-secondary))");
  const fg = validHex(settings.announcementColor) || (validHex(settings.announcementBg) ? readableOn(settings.announcementBg) : brandHeader ? "#111827" : "#FFFFFF");
  const size = SIZE[settings.announcementSize || "md"] ?? SIZE.md;
  const link = (settings.announcementLink || "").trim();
  const external = /^https?:/.test(link);
  const marquee = settings.announcementStyle === "marquee";
  const icon = (settings.announcementIcon || "").trim();

  const message = (
    <span className="inline-flex items-center gap-2 font-semibold">
      {icon ? <span aria-hidden>{icon}</span> : <Megaphone />}
      <span>{text}</span>
      {settings.announcementCta && link && <span className="rounded-full border border-current px-2 py-px text-[0.85em] font-bold underline-offset-2 hover:underline">{settings.announcementCta}</span>}
    </span>
  );
  const wrap = (child: React.ReactNode) => link
    ? (external
      ? <a href={link} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">{child}</a>
      : <Link href={link} className="block hover:opacity-90">{child}</Link>)
    : <>{child}</>;

  return (
    <div role="region" aria-label="Announcement" className={`relative ${size}`} style={{ background: bg, color: fg }}>
      <div className="page-w mx-auto flex items-center px-3 sm:px-4">
        <div className={`min-w-0 flex-1 ${marquee ? "overflow-hidden" : "text-center"} ${settings.announcementDismissible ? "pr-8" : ""}`}>
          {marquee ? (
            <div className="ann-track" aria-live="off">
              {[0, 1].map((n) => <div key={n} className="flex shrink-0 items-center px-8" aria-hidden={n === 1}>{wrap(message)}</div>)}
            </div>
          ) : wrap(message)}
        </div>
        {settings.announcementDismissible && (
          <button type="button" aria-label="Close announcement" onClick={() => { setClosed(true); try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ } }}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/10 sm:right-3">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
