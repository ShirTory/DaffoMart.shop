"use client";
import { useState } from "react";
import { playableVideo, type VideoSource } from "@/lib/productPage";
import type { ProductVideo } from "@/lib/types";

/** Poster first, player on click: nothing heavy loads until the customer asks for it. Uploaded / direct files use the native controls (mobile + desktop). */
export default function VideoPlayer({ video, name }: { video: ProductVideo; name: string }) {
  const src: VideoSource | null = playableVideo(video);
  const [on, setOn] = useState(false);
  if (!src) return null;
  const poster = video.poster || (src.type === "youtube" ? src.thumb : undefined);
  const title = video.title || `${name} video`;
  if (src.type === "file") return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-card">
      <video controls playsInline preload="none" poster={poster} className="aspect-video w-full bg-black" aria-label={title}><source src={src.url} type={src.url.includes(".webm") ? "video/webm" : "video/mp4"} />Your browser cannot play this video.</video>
    </div>
  );
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 shadow-card">
      {on ? <iframe src={src.embed} title={title} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : (
          <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 flex items-center justify-center" aria-label={`Play: ${title}`}>
            {poster /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100" /> : null}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-primary shadow-lg transition group-hover:scale-105"><svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg></span>
          </button>)}
    </div>
  );
}
