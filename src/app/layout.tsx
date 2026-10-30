import GoogleTagManager from '../components/GoogleTagManager'
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DEFAULT_DESC, DEFAULT_OG, DEFAULT_TAGLINE, SITE_NAME, SITE_URL } from "@/lib/site";
import { getSettings } from "@/server/queries";

/** Site-wide defaults. Title, description, favicon and sharing image come from Admin → Settings & SEO; pages refine them with pageMeta() (src/lib/seo.ts). */
export async function generateMetadata(): Promise<Metadata> {
  let name = SITE_NAME, tagline = DEFAULT_TAGLINE, desc = DEFAULT_DESC, og = DEFAULT_OG, fav = "", seoTitle = "";
  try {
    const s = await getSettings();
    name = s.storeName || name; tagline = s.tagline || tagline; desc = s.seoDescription || desc; og = s.ogImage || og; fav = s.favicon || ""; seoTitle = s.seoTitle || "";
  } catch { /* database unreachable: fall back to the defaults above */ }
  const title = seoTitle || `${name} – ${tagline}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${name}` },
    description: desc,
    applicationName: name,
    manifest: "/manifest.webmanifest",
    icons: fav
      ? { icon: [{ url: fav }], shortcut: [{ url: fav }], apple: [{ url: fav }] }
      : { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon-16.png", sizes: "16x16", type: "image/png" }, { url: "/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], shortcut: [{ url: "/favicon.ico" }], apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
    openGraph: { type: "website", siteName: name, locale: "en_BD", title, description: desc, images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description: desc, images: [og] },
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } } : {}),
  };
}
export const viewport: Viewport = { themeColor: "#1E3A8A", width: "device-width", initialScale: 1 };

// Tells Google the site's name (and the alternate name people may type), the internal search box and the official profiles. Values come from Admin → Settings.
async function siteSchema() {
  let s: Awaited<ReturnType<typeof getSettings>> | null = null;
  try { s = await getSettings(); } catch { /* database unreachable: static fallback */ }
  const name = s?.storeName || "DaffoMart";
  const sameAs = [s?.facebook, s?.instagram, s?.youtube, s?.tiktok].filter((u): u is string => !!u && /^https?:\/\//i.test(u));
  const logo = s?.iconImages?.logo || `${SITE_URL}/logo.png`;
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name, alternateName: ["daffomartshop", "DaffoMart Shop", "daffomart"], url: `${SITE_URL}/`, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/products?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
    { "@context": "https://schema.org", "@type": "Organization", name, url: `${SITE_URL}/`, logo, ...(sameAs.length ? { sameAs } : {}), ...(s?.phone ? { contactPoint: { "@type": "ContactPoint", telephone: s.phone, contactType: "customer service", areaServed: "BD" } } : {}) },
  ];
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const siteLd = await siteSchema();
  return (
    <html lang="en">
      <head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd).replace(/</g, "\\u003c") }} /></head>
      <body className="font-sans">
        <GoogleTagManager />{children}</body>
    </html>
  );
}
