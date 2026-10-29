"use client";
import { useState } from "react";

/**
 * Smooth, continuously moving horizontal strip (left → right). The content is rendered twice and translated by half its
 * width, so the loop is seamless. Pauses on hover / keyboard focus, has a visible Pause/Play button (WCAG 2.2.2) and
 * falls back to a static, wrapped, fully visible list when the visitor prefers reduced motion (see globals.css).
 * The duplicate copy is hidden from screen readers and cannot take focus.
 */
export default function Ticker({ children, seconds, label, pauseLabel = "Pause" , playLabel = "Play" }: { children: React.ReactNode; seconds: number; label: string; pauseLabel?: string; playLabel?: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <div>
      <div className="mb-1 flex justify-end motion-reduce:hidden">
        <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={`${paused ? playLabel : pauseLabel}: ${label}`} className="rounded-full border border-gray-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-white">
          {paused ? "▶ " + playLabel : "⏸ " + pauseLabel}
        </button>
      </div>
      <div className="ticker" data-paused={paused} style={{ "--ticker-dur": `${Math.max(8, Math.round(seconds))}s` } as React.CSSProperties} role="region" aria-roledescription="carousel" aria-label={label}>
        <div className="ticker-track">
          <div className="ticker-set">{children}</div>
          <div className="ticker-set" data-clone="true" aria-hidden="true" {...({ inert: true } as object)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
