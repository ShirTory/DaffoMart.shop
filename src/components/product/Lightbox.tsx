"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Thumbnail grid + full-screen viewer: arrows / swipe-free buttons, keyboard (← → Esc), click the photo to zoom. */
export default function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null); const [zoom, setZoom] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null); const opener = useRef<HTMLElement | null>(null);
  const n = images.length;
  const go = useCallback((d: number) => { setZoom(false); setOpen((i) => (i === null ? i : (i + d + n) % n)); }, [n]);
  useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
    document.addEventListener("keydown", key); document.body.style.overflow = "hidden"; closeBtn.current?.focus();
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; opener.current?.focus(); };
  }, [open, go]);
  if (!n) return null;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((u, i) => (
          <li key={u + i}><button type="button" onClick={(e) => { opener.current = e.currentTarget; setOpen(i); }} className="group block aspect-square w-full overflow-hidden rounded-xl border bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Open photo ${i + 1} of ${n}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`${name} – photo ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 motion-safe:group-hover:scale-105" /></button></li>))}
      </ul>
      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={`${name} photos`} className="fixed inset-0 z-[80] flex flex-col bg-black/90" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm">{open + 1} / {n}</span>
            <button ref={closeBtn} type="button" onClick={() => setOpen(null)} className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold hover:bg-white/25">Close ✕</button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-14" onClick={(e) => e.stopPropagation()}>
            {n > 1 && <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">‹</button>}
            <div className={`flex max-h-full max-w-full ${zoom ? "overflow-auto" : "overflow-hidden"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[open]} alt={`${name} – photo ${open + 1}`} onClick={() => setZoom((z) => !z)} className={`select-none ${zoom ? "max-w-none cursor-zoom-out" : "max-h-[78vh] max-w-full cursor-zoom-in object-contain"}`} style={zoom ? { width: "160%" } : undefined} />
            </div>
            {n > 1 && <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">›</button>}
          </div>
          <p className="px-4 py-2 text-center text-xs text-white/70">Click the photo to zoom</p>
        </div>)}
    </>
  );
}
