"use client";
import Script from "next/script";
import { useEffect } from "react";

/** Loads Meta Pixel only when a real Pixel ID is configured in Admin → Settings. */
export default function MetaPixel({ pixelId }: { pixelId?: string }) {
  const id = (pixelId || "").trim();
  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    // Avoid duplicate init across client navigations
    const w = window as unknown as { fbq?: (...a: unknown[]) => void; _fbq?: unknown };
    if (typeof w.fbq === "function") {
      try { w.fbq("track", "PageView"); } catch { /* ignore */ }
    }
  }, [id]);
  if (!id) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id.replace(/[^0-9A-Za-z]/g, "")}');
fbq('track','PageView');
`}</Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} src={`https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`} alt="" />
      </noscript>
    </>
  );
}
