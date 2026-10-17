"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";

export default function HeroSlider({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0); const [pause, setPause] = useState(false); const n = banners.length;
  useEffect(() => { if (n < 2 || pause) return; const t = setInterval(() => setI((x) => (x + 1) % n), 5500); return () => clearInterval(t); }, [n, pause]);
  return (
    <section className="group relative -mx-4 overflow-hidden bg-gray-100 shadow-card sm:mx-0 sm:rounded-2xl" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)} aria-roledescription="carousel">
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b, idx) => {
          const hasText = b.title || b.subtitle || b.ctaLabel;
          const inner = (
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/5]">
              <picture>{b.mobileImage && <source media="(max-width: 639px)" srcSet={b.mobileImage} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt={b.title || "Offer"} className="absolute inset-0 h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} fetchPriority={idx === 0 ? "high" : "auto"} decoding="async" /></picture>
              {hasText && (<div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/60 via-black/25 to-transparent px-6 sm:px-12">
                <div className="max-w-lg text-white">{b.title && <h2 className="text-2xl font-extrabold leading-tight drop-shadow sm:text-4xl">{b.title}</h2>}{b.subtitle && <p className="mt-2 text-sm text-white/90 sm:text-base">{b.subtitle}</p>}
                  {b.ctaLabel && <span className="btn-accent mt-4 inline-flex px-6 py-2.5">{b.ctaLabel}</span>}</div></div>)}
            </div>);
          return <div key={b.id} className="w-full shrink-0" aria-hidden={idx !== i}>{b.ctaHref && !b.ctaLabel ? <Link href={b.ctaHref}>{inner}</Link> : b.ctaHref ? <Link href={b.ctaHref} tabIndex={idx === i ? 0 : -1}>{inner}</Link> : inner}</div>;
        })}
      </div>
      {n > 1 && (<>
        <button onClick={() => setI((i - 1 + n) % n)} aria-label="Previous slide" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white sm:group-hover:flex">‹</button>
        <button onClick={() => setI((i + 1) % n)} aria-label="Next slide" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white sm:group-hover:flex">›</button>
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">{banners.map((b, k) => <button key={b.id} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />)}</div>
      </>)}
    </section>
  );
}
