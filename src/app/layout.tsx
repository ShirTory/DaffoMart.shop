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

// Tells Google the site's name (and the alternate name people may type) so search results show "DaffoMart" for this address.
const siteSchema = [
  { "@context": "https://schema.org", "@type": "WebSite", name: "DaffoMart", alternateName: ["daffomartshop", "DaffoMart Shop", "daffomart"], url: `${SITE_URL}/` },
  { "@context": "https://schema.org", "@type": "Organization", name: "DaffoMart", url: `${SITE_URL}/`, logo: `${SITE_URL}/logo.png` },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }} /></head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
