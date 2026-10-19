"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StoreSettings } from "@/lib/types";
import { readableOn, validHex } from "@/lib/theme";

const SIZE = { sm: "py-1 text-[11px] sm:text-xs", md: "py-1.5 text-xs sm:text-[13px]", lg: "py-2.5 text-sm sm:text-base" } as const;
const WEIGHT = { normal: "font-normal", semibold: "font-semibold", bold: "font-bold", black: "font-black" } as const;
const SPEED = { slow: 0.65, normal: 1, fast: 1.7 } as const;

/** Small hash so a changed message shows again even if an older one was dismissed. */
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

function Megaphone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/** Text that slides to its end and back ("ping-pong") when it is wider than the bar; centred and still when it fits. */
function Bounce({ children, speed }: { children: React.ReactNode; speed: number }) {
  const box = useRef<HTMLDivElement>(null); const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const measure = () => { if (box.current && inner.current) setShift(Math.min(0, box.current.clientWidth - inner.current.scrollWidth - 8)); };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && box.current) ro.observe(box.current);
    return () => ro?.disconnect();
  }, [children]);
  const moves = shift < 0;
  const dur = Math.max(6, Math.abs(shift) / 28 + 5) / speed;
  return (
    <div ref={box} className={`overflow-hidden ${moves ? "" : "text-center"}`}>
      <span ref={inner} className={moves ? "ann-bounce" : "inline-flex"} style={moves ? ({ "--ann-shift": `${shift}px`, "--ann-dur": `${dur}s` } as React.CSSProperties) : undefined}>{children}</span>
    </div>
  );
}

/**
 * Top headline strip. It always uses a colour that differs from the header (accent colour on a dark header, deep brand colour on a light one),
 * with automatically readable text. Admin → Appearance → Announcement bar controls the headlines (one per line), movement
 * (still / scrolling / back-and-forth / one-by-one), speed, boldness, colours, icon, link and the close button.
 */
export default function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  const text = (settings.announcement || "").trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const key = `ann-closed:${hash(text)}`;
  const [closed, setClosed] = useState(false);
  const [idx, setIdx] = useState(0);
  const mode = settings.announcementStyle || "static";
  const speed = SPEED[settings.announcementSpeed || "normal"] ?? 1;
  useEffect(() => { try { if (settings.announcementDismissible && sessionStorage.getItem(key)) setClosed(true); } catch { /* storage blocked */ } }, [key, settings.announcementDismissible]);
  useEffect(() => {
    setIdx(0);
    if (mode !== "rotate" || lines.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % lines.length), Math.round(3800 / speed));
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, text, speed]);
  if (!lines.length || closed) return null;

  const brandHeader = settings.headerTheme === "brand" && !validHex(settings.headerBg);
  const bg = validHex(settings.announcementBg) || (brandHeader ? "rgb(var(--c-accent))" : "rgb(var(--c-secondary))");
  const fg = validHex(settings.announcementColor) || (validHex(settings.announcementBg) ? readableOn(settings.announcementBg) : brandHeader ? "#111827" : "#FFFFFF");
  const size = SIZE[settings.announcementSize || "md"] ?? SIZE.md;
  const weight = WEIGHT[settings.announcementWeight || "semibold"] ?? WEIGHT.semibold;
  const link = (settings.announcementLink || "").trim();
  const external = /^https?:/.test(link);
  const icon = (settings.announcementIcon || "").trim();
  const sep = (settings.announcementSep ?? "•").trim() || "•";

  const iconEl = icon ? <span aria-hidden>{icon}</span> : <Megaphone />;
  const cta = settings.announcementCta && link ? <span className="rounded-full border border-current px-2 py-px text-[0.85em] font-bold underline-offset-2 hover:underline">{settings.announcementCta}</span> : null;
  /** all headlines in one run, separated by the chosen symbol (used by the moving styles) */
  const run = (
    <span className={`inline-flex items-center gap-2 ${weight}`}>
      {iconEl}
      {lines.map((l, k) => <span key={k} className="inline-flex items-center gap-2">{k > 0 && <span aria-hidden className="opacity-60">{sep}</span>}<span>{l}</span></span>)}
      {cta}
    </span>
  );
  const single = (l: string, animate?: boolean) => (
    <span key={animate ? l + idx : undefined} className={`inline-flex items-center justify-center gap-2 ${weight} ${animate ? "ann-swap" : ""}`}>{iconEl}<span>{l}</span>{cta}</span>
  );
  const wrap = (child: React.ReactNode) => link
    ? (external
      ? <a href={link} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">{child}</a>
      : <Link href={link} className="block hover:opacity-90">{child}</Link>)
    : <>{child}</>;

  let body: React.ReactNode;
  if (mode === "marquee") {
    const chars = lines.join(" ").length + 12;
    const dur = Math.max(14, chars * 0.32) / speed;
    body = (
      <div className="overflow-hidden">
        <div className="ann-track" aria-live="off" style={{ animationDuration: `${dur}s`, animationDirection: settings.announcementDirection === "right" ? "reverse" : "normal" }}>
          {[0, 1].map((n) => <div key={n} className="flex min-w-full shrink-0 items-center justify-start px-8" aria-hidden={n === 1}>{wrap(run)}</div>)}
        </div>
      </div>
    );
  } else if (mode === "bounce") body = wrap(<Bounce speed={speed}>{run}</Bounce>);
  else if (mode === "rotate" && lines.length > 1) body = <div className="overflow-hidden text-center" aria-live="polite">{wrap(single(lines[idx % lines.length], true))}</div>;
  else body = <div className="text-center">{wrap(single(lines[0]))}</div>;

  return (
    <div role="region" aria-label="Announcement" className={`relative ${size}`} style={{ background: bg, color: fg }}>
      <div className="page-w mx-auto flex items-center px-3 sm:px-4">
        <div className={`min-w-0 flex-1 ${settings.announcementDismissible ? "pr-8" : ""}`}>{body}</div>
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
