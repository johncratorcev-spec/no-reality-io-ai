import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Карта сайта: лендинг (приоритет 1) + фид и legal-страницы.
 * /v/[code] — бесконечное пространство deep-link'ов, в sitemap не входит.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE.url + "/", lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: SITE.url + "/feed", lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: SITE.url + "/terms", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: SITE.url + "/creators", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
