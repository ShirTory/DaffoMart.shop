"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";

/** Admin banners as a slider. `lead` (e.g. the built-in grocery banner) is shown as the first slide. Autoplay is off for users who prefer reduced motion. */
export default function HeroSlider({ banners, lead }: { banners: Banner[]; lead?: React.ReactNode }) {
  const [i, setI] = useState(0); const [pause, setPause] = useState(false); const [reduce, setReduce] = useState(false);
  const off = lead ? 1 : 0; const n = banners.length + off;
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches); on();
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => { if (n < 2 || pause || reduce) return; const t = setInterval(() => setI((x) => (x + 1) % n), 5500); return () => clearInterval(t); }, [n, pause, reduce]);
  return (
    <section className="group relative -mx-4 overflow-hidden bg-gray-100 shadow-card sm:mx-0 sm:rounded-2xl" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)} onFocus={() => setPause(true)} onBlur={() => setPause(false)} aria-roledescription="carousel" aria-label="Featured offers">
      <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${i * 100}%)` }}>
        {lead && <div className="w-full shrink-0" data-active={i === 0} aria-hidden={i !== 0} {...(i !== 0 ? { inert: true } : {})}>{lead}</div>}
        {banners.map((b, k) => {
          const idx = k + off;
          const hasText = b.title || b.subtitle || b.ctaLabel;
          const inner = (
            <div className="relative aspect-[21/9] w-full max-h-[140px] sm:aspect-[16/5] sm:max-h-none">
              <picture>{b.mobileImage && <source media="(max-width: 639px)" srcSet={b.mobileImage} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt={b.title || "Offer"} className="absolute inset-0 h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} fetchPriority={idx === 0 ? "high" : "auto"} decoding="async" /></picture>
              {hasText && (<div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/60 via-black/25 to-transparent px-6 sm:px-12">
                <div className="max-w-lg text-white">{b.title && <h2 className="slide-in text-lg font-extrabold leading-tight drop-shadow sm:text-4xl">{b.title}</h2>}{b.subtitle && <p className="slide-in mt-1 line-clamp-2 text-xs text-white/90 sm:mt-2 sm:text-base" style={{ "--d": "80ms" } as React.CSSProperties}>{b.subtitle}</p>}
                  {b.ctaLabel && <span className="slide-in btn-accent mt-2 inline-flex px-4 py-1.5 text-sm sm:mt-4 sm:px-6 sm:py-2.5" style={{ "--d": "160ms" } as React.CSSProperties}>{b.ctaLabel}</span>}</div></div>)}
            </div>);
          return <div key={b.id} className="w-full shrink-0" data-active={idx === i} aria-hidden={idx !== i}>{b.ctaHref && !b.ctaLabel ? <Link href={b.ctaHref}>{inner}</Link> : b.ctaHref ? <Link href={b.ctaHref} tabIndex={idx === i ? 0 : -1}>{inner}</Link> : inner}</div>;
        })}
      </div>
      {n > 1 && (<>
        <button onClick={() => setI((i - 1 + n) % n)} aria-label="Previous slide" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white sm:group-hover:flex">‹</button>
        <button onClick={() => setI((i + 1) % n)} aria-label="Next slide" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white sm:group-hover:flex">›</button>
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">{Array.from({ length: n }, (_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />)}</div>
      </>)}
    </section>
  );
}
