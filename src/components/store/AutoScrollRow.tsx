"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Horizontal row that glides back and forth by itself. Every child is rendered exactly ONCE (no cloned copies, so no
 * duplicate items while moving). Stops while hovered / touched / focused or paused, never moves when everything fits,
 * and does not move at all when the visitor prefers reduced motion (the row is then a normal swipeable list).
 */
export default function AutoScrollRow({ children, label, pxPerSec = 28, className = "" }: { children: React.ReactNode; label: string; pxPerSec?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const hold = useRef(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = 0, pos = el.scrollLeft, dir = 1, wait = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      const max = el.scrollWidth - el.clientWidth;
      if (max > 4 && !hold.current && !pausedRef.current && !document.hidden) {
        if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft; // the visitor scrolled by hand: continue from there
        if (wait > 0) wait -= dt;
        else {
          pos += dir * pxPerSec * dt;
          if (pos >= max) { pos = max; dir = -1; wait = 1.2; } else if (pos <= 0) { pos = 0; dir = 1; wait = 1.2; }
          el.scrollLeft = pos;
        }
      } else pos = el.scrollLeft;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pxPerSec]);
  const on = () => { hold.current = true; }; const off = () => { hold.current = false; };
  return (
    <div>
      <div className="mb-1 flex justify-end motion-reduce:hidden">
        <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={`${paused ? "Play" : "Pause"}: ${label}`} className="rounded-full border border-gray-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-white">{paused ? "▶ Play" : "⏸ Pause"}</button>
      </div>
      <div ref={box} role="region" aria-label={label} onMouseEnter={on} onMouseLeave={off} onTouchStart={on} onTouchEnd={() => setTimeout(off, 1500)} onFocus={on} onBlur={off} className={`no-scrollbar flex overflow-x-auto overscroll-x-contain ${className}`}>{children}</div>
    </div>
  );
}
