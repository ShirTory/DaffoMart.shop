import type { Metadata } from "next";
import Link from "next/link";
import { getSeoMap, getSettings, getZones } from "@/server/queries";
import { taka } from "@/lib/format";
import { mapsEmbed } from "@/lib/maps";
import { pageMeta, withSeo } from "@/lib/seo";
import BrandIcon, { ICON_LABEL } from "@/components/store/BrandIcon";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta(withSeo({ title: "Contact & Delivery", path: "/contact" }, (await getSeoMap()).contact));
}
export const revalidate = 60; // served from cache, refreshed when the admin saves (and at most every 60 s)

export default async function ContactPage() {
  const [s, zones] = await Promise.all([getSettings(), getZones()]);
  const wa = s.whatsapp.replace(/\D/g, "");
  const link = (href: string, text: string, ext = false) => <a className="text-primary hover:underline" href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{text}</a>;
  const rows: [string, string, React.ReactNode][] = [
    ["address", "Address", s.address], ["phone", "Phone", s.phone && link(`tel:${s.phone.replace(/[^\d+]/g, "")}`, s.phone)],
    ["whatsapp", "WhatsApp", wa.length >= 8 && link(`https://wa.me/${wa}`, s.whatsapp, true)],
    ["email", "Email", s.email && link(`mailto:${s.email}`, s.email)],
  ];
  const socials = (["facebook", "instagram", "youtube", "tiktok"] as const).map((k) => [k, (s[k] || "").trim()] as const).filter(([, v]) => /^https?:\/\//i.test(v));
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Contact &amp; delivery</h1><p className="mt-1 text-sm text-gray-500">We are happy to help with orders, medicine and delivery questions.</p>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-card"><h2 className="font-bold">{s.storeName}</h2>
          {rows.filter(([, , v]) => v).map(([i, l, v]) => <div key={l} className="flex gap-3 text-sm"><BrandIcon k={i} settings={s} size="h-9 w-9" /><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{l}</p><p>{v}</p></div></div>)}
          {s.hours && <p className="text-sm text-gray-600">Opening hours: {s.hours}</p>}
          {socials.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Social media">{socials.map(([k, href]) => <a key={k} href={href} target="_blank" rel="noopener noreferrer" aria-label={ICON_LABEL[k]} className="transition hover:scale-105 active:scale-95"><BrandIcon k={k} settings={s} size="h-11 w-11" /></a>)}</div>}
          {s.address && <iframe title="Store location" src={mapsEmbed({ address: s.address })} className="h-56 w-full rounded-xl border-0" loading="lazy" />}
          {s.mapUrl && <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">View on map</a>}
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-card"><h2 className="font-bold">Delivery areas &amp; charges</h2>
          <ul className="mt-3 divide-y text-sm">{zones.map((z) => <li key={z.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{z.name}</p><p className="text-xs text-gray-500">{[z.eta, z.freeOver > 0 ? `Free over ${taka(z.freeOver)}` : ""].filter(Boolean).join(" · ")}</p></div><span className="font-bold text-primary">{z.charge === 0 ? "Free" : taka(z.charge)}</span></li>)}</ul>
          {s.minOrder > 0 && <p className="mt-2 text-xs text-gray-500">Minimum order: {taka(s.minOrder)}</p>}
          <Link href="/products" className="btn-primary mt-4">Start shopping</Link></section>
      </div>
    </div>
  );
}
