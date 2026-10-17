"use client";
import { useState } from "react";
export default function Gallery({ images, emoji, name }: { images: string[]; emoji: string; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-primary-soft">
        {images.length ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={images[i]} alt={name} decoding="async" fetchPriority="high" className="h-full w-full object-cover" /> : <span className="text-9xl">{emoji}</span>}</div>
      {images.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2">{images.map((u, k) => (
        <button key={u} onClick={() => setI(k)} className={`aspect-square overflow-hidden rounded-lg border-2 ${k === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /></button>))}</div>}
    </div>
  );
}
