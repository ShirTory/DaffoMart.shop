import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      // /api/uploads/ holds the product and category photos: crawlers must be able to fetch them (the longer Allow rule wins over Disallow /api/).
      allow: ["/", "/api/uploads/"],
      disallow: ["/admin", "/rider", "/api/", "/cart", "/checkout", "/track", "/pay/", "/invoice"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
