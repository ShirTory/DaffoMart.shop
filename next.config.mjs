/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["sharp", "firebase-admin"],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  images: {
    // product/category photos are served resized (small WebP) by the optimizer and cached for a day
    remotePatterns: [{ protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" }],
    formats: ["image/webp"], minimumCacheTTL: 86400,
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ] },
    // private areas must never be indexed, even if a link to them leaks
    { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    { source: "/rider/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    { source: "/:file(logo.png|logo-horizontal.png|icon-mark.png|og-default.png)", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
  ];
  },
};
export default nextConfig;
