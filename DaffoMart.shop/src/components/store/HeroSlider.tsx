"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";
import { readableOn, validHex } from "@/lib/theme";
import { HERO_HEIGHT } from "@/lib/fx";

const OVERLAY = { dark: "bg-gradient-to-r from-black/60 via-black/25 to-transparent", light: "bg-gradient-to-r from-white/80 via-white/40 to-transparent", none: "" } as const;
const ALIGN = { left: "justify-start text-left", center: "justify-center text-center", right: "justify-end text-right" } as const;

/** Admin banners as a slider. `lead` (e.g. the built-in grocery banner) is shown as the first slide. GIF / animated WebP covers play as-is.
 *  Autoplay is off for users who prefer reduced motion. Each cover can have its own fit, overlay, text colour, alignment and schedule (Admin → Cover Images). */
export default function HeroSlider({ banners, lead, autoplay = true, intervalMs = 5500, transition = "slide", showArrows = true, showDots = true, rounded = true, height = "md" }: {
  banners: Banner[]; lead?: React.ReactNode; autoplay?: boolean; intervalMs?: number; transition?: "slide" | "fade"; showArrows?: boolean; showDots?: boolean; rounded?: boolean; height?: "sm" | "md" | "lg";
}) {
  const [i, setI] = useState(0); const [pause, setPause] = useState(false); const [reduce, setReduce] = useState(false);
  const off = lead ? 1 : 0; const n = banners.length + off;
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches); on();
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => { if (n < 2 || pause || reduce || !autoplay) return; const t = setInterval(() => setI((x) => (x + 1) % n), intervalMs); return () => clearInterval(t); }, [n, pause, reduce, autoplay, intervalMs]);
  const fade = transition === "fade";

  const slides = banners.map((b, k) => {
    const idx = k + off;
    const hasText = b.title || b.subtitle || b.ctaLabel;
    const fit = b.fit === "contain" ? "object-contain" : "object-cover";
    const ov = b.overlay === "none" ? "none" : b.overlay === "light" ? "light" : "dark";
    const fg = validHex(b.textColor) || (ov === "light" ? "#111827" : "#FFFFFF");
    const ctaStyle: React.CSSProperties | undefined = validHex(b.ctaBg) ? { background: validHex(b.ctaBg), borderColor: validHex(b.ctaBg), color: validHex(b.ctaColor) || readableOn(b.ctaBg) } : validHex(b.ctaColor) ? { color: validHex(b.ctaColor) } : undefined;
    const al = ALIGN[b.align || "left"] ?? ALIGN.left;
    const inner = (
      <div className={`relative w-full ${HERO_HEIGHT[height] ?? HERO_HEIGHT.md}`} style={validHex(b.bg) ? { background: validHex(b.bg) } : undefined}>
        <picture>{b.mobileImage && <source media="(max-width: 639px)" srcSet={b.mobileImage} />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.image} alt={b.alt || b.title || "Offer"} className={`absolute inset-0 h-full w-full ${fit}`} loading={idx === 0 ? "eager" : "lazy"} fetchPriority={idx === 0 ? "high" : "auto"} decoding="async" /></picture>
        {hasText && (
          <div className={`absolute inset-0 flex items-center px-6 sm:px-12 ${OVERLAY[ov]} ${al}`}>
            <div className="max-w-lg" style={{ color: fg }}>
              {b.title && <h2 className={`slide-in text-lg font-extrabold leading-tight sm:text-4xl ${ov === "dark" ? "drop-shadow" : ""}`}>{b.title}</h2>}
              {b.subtitle && <p className="slide-in mt-1 line-clamp-2 text-xs opacity-90 sm:mt-2 sm:text-base" style={{ "--d": "80ms" } as React.CSSProperties}>{b.subtitle}</p>}
              {b.ctaLabel && <span className="slide-in btn-accent mt-2 inline-flex px-4 py-1.5 text-sm sm:mt-4 sm:px-6 sm:py-2.5" style={{ "--d": "160ms", ...ctaStyle } as React.CSSProperties}>{b.ctaLabel}</span>}
            </div>
          </div>
        )}
      </div>);
    const ext = /^https?:/.test(b.ctaHref || "");
    const linkProps = { tabIndex: idx === i ? 0 : -1, ...(b.newTab || ext ? { target: "_blank", rel: "noopener noreferrer" } : {}) };
    const content = b.ctaHref ? (ext || b.newTab ? <a href={b.ctaHref} {...linkProps}>{inner}</a> : <Link href={b.ctaHref} {...linkProps}>{inner}</Link>) : inner;
    return <div key={b.id} className={fade ? "w-full" : "w-full shrink-0"} data-active={idx === i} aria-hidden={idx !== i}>{content}</div>;
  });

  const leadSlide = lead && <div className={fade ? "w-full" : "w-full shrink-0"} data-active={i === 0} aria-hidden={i !== 0} {...(i !== 0 ? { inert: true } : {})}>{lead}</div>;

  return (
    <section className={`group relative -mx-4 overflow-hidden bg-gray-100 shadow-card sm:mx-0 ${rounded ? "sm:rounded-2xl" : ""}`} onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)} onFocus={() => setPause(true)} onBlur={() => setPause(false)} aria-roledescription="carousel" aria-label="Featured offers">
      {fade ? (
        <div className="hero-fade relative">{leadSlide}{slides}</div>
      ) : (
        <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${i * 100}%)` }}>{leadSlide}{slides}</div>
      )}
      {n > 1 && (<>
        {showArrows && <>
          <button onClick={() => setI((i - 1 + n) % n)} aria-label="Previous slide" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-gray-800 shadow transition hover:bg-white sm:group-hover:flex">‹</button>
          <button onClick={() => setI((i + 1) % n)} aria-label="Next slide" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-gray-800 shadow transition hover:bg-white sm:group-hover:flex">›</button>
        </>}
        {showDots && <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">{Array.from({ length: n }, (_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-current={k === i} className={`h-2 rounded-full shadow-sm transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />)}</div>}
      </>)}
    </section>
  );
}
