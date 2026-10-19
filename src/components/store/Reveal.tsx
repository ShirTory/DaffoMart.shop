"use client";
import { useEffect, useRef } from "react";

/**
 * Fades/slides its child in when it scrolls into view. Server HTML is fully visible (no-JS / reduced-motion safe):
 * only content that starts below the fold is hidden after hydration, then revealed once by an IntersectionObserver.
 */
export default function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) return; // already on screen: leave as rendered
    el.classList.add("reveal-pending");
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      el.classList.add("reveal-show");
      el.classList.remove("reveal-pending");
      setTimeout(() => el.classList.remove("reveal-show"), 900 + delay); // drop the transition so later hover transforms aren't delayed
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className={className} style={delay ? ({ "--d": `${delay}ms` } as React.CSSProperties) : undefined}>{children}</div>;
}
