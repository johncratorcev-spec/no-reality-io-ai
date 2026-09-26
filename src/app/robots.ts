import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * robots.txt (v3 hub): открыт всем краулерам — и классическим, и
 * генеративным. GEO-стратегия хаба: AI-движки (AI Overviews, Perplexity,
 * ChatGPT search, Claude) должны ЦИТИРОВАТЬ нас, поэтому каждый
 * сборщик контента явно разрешён. Закрыты только API и админка.
 */
export default function robots(): MetadataRoute.Robots {
  const aiCrawlers = [
    // поисковые + генеративные движки
    "Googlebot",
    "Google-Extended", // обучение/ответы Gemini
    "Bingbot",
    "BingPreview",
    "GPTBot", // OpenAI сбор
    "OAI-SearchBot", // ChatGPT search
    "ChatGPT-User",
    "ClaudeBot", // Anthropic сбор
    "Claude-User",
    "Claude-SearchBot",
    "PerplexityBot", // Perplexity ответчик
    "Perplexity-User",
    "Applebot",
    "Applebot-Extended",
    "CCBot",
    "Bytespider",
    "Amazonbot",
    "meta-externalagent",
    "YouBot",
    "Diffbot",
  ];

  return {
    rules: [
      ...aiCrawlers.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api/", "/admin/"],
      })),
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
