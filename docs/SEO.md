# SEO (Admin → SEO)
* Per page: title, meta description, keywords, sharing image, canonical URL, noindex. Pages: Homepage, All products, Offers (/products?sale=1), Contact, Return policy, Medicine, every category, every product.
* Stored in the `seo_overrides` collection (server-only). Empty fields keep the automatic value. "Back to automatic" deletes the entry.
* Saving clears the storefront cache, so titles/descriptions change on the next page load; the sitemap is built from the live catalogue on each request (new/edited/deleted/inactive products and noindex pages follow automatically).
* Always generated: canonical URLs, Open Graph + Twitter cards, WebSite (with search box) and Organization schema (profiles + phone from Settings), Product schema (price, stock, rating, reviews) and BreadcrumbList on product pages, robots.txt, /sitemap.xml, favicon from Settings.
* Filtered / sorted / paged product listings are always noindex.
* Google decides when to index. After deploying: Search Console → Sitemaps → add `/sitemap.xml`, then URL Inspection → Request indexing for the homepage and key products. Set NEXT_PUBLIC_SITE_URL to the real https address in Netlify.
