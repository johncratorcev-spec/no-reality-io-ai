import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Карта сайта (v4): лендинг, две ленты (feed/bet), GEO-кластер
 * (real-or-synth) и легаси-разделы.
 * /v/[code] — бесконечное пространство deep-link'ов, в sitemap не входит.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const p = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  ) => ({
    url: SITE.url + path,
    lastModified: now,
    changeFrequency,
    priority,
    ...(path !== "/" && path !== "/feed"
      ? { alternates: { languages: { en: SITE.url + path, ru: `${SITE.url}${path}?lang=ru` } } }
      : {}),
  });

  return [
    p("/", 1, "daily"),
    p("/feed", 0.9, "hourly"),
    p("/bet", 0.9, "hourly"),
    p("/real-or-synth", 0.9, "weekly"),
    p("/market", 0.7, "weekly"),
    p("/predict", 0.7, "weekly"),
    p("/pnl", 0.4, "weekly"),
    p("/collab", 0.6, "weekly"),
    p("/future", 0.5, "weekly"),
    p("/terms", 0.3, "yearly"),
    p("/creators", 0.3, "yearly"),
  ];
}
