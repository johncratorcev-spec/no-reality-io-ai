import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * robots.txt (task 43): open to all crawlers, sitemap + host from the single
 * source of truth (SITE.url) — the old static file pointed at the dead
 * no-reality.io domain.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
