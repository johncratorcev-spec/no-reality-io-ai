import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";
import { HUB_FAQ } from "@/lib/hubFaq";
import { SITE, SOCIALS } from "@/lib/site";

/**
 * Главная = кровавый карнавал-лендинг (v4, статика — идеальна для SEO/GEO).
 * Две ленты сайта: /feed — бесконечные ИИ-видео, /bet — рафлы
 * «угадай, ИИ или нет». Deep-link'и — /v/[code].
 *
 * JSON-LD: WebSite + Organization + FAQPage (EN) — Google Rich Results
 * и генеративные движки (AI Overviews, Perplexity, ChatGPT search)
 * вытаскивают факты проекта из структурированных данных.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { absolute: SITE.title },
  description: SITE.description,
  keywords: [
    "AI content hub",
    "AI predictions",
    "real or synth",
    "AI generated video",
    "synthetic media game",
    "spot AI video",
    "AI video feed",
    "prediction raffle",
    "pari-mutuel betting",
    "crypto predictions",
    "prompt market",
    "Veo prompts",
    "интерактивный хаб",
    "AI-контент",
    "реал или синтик",
  ],
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      ru: "/?lang=ru",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
    title: { absolute: SITE.title },
    description: SITE.description,
    locale: "en_US",
    alternateLocale: ["ru_RU"],
    images: [
      {
        url: "/images/og-vhs.png",
        width: 1200,
        height: 630,
        alt: "no reality. — watch what shouldn’t exist. bet the seam.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: { absolute: SITE.title },
    description: SITE.description,
    images: ["/images/og-vhs.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      alternateName: "no reality",
      description: SITE.description,
      inLanguage: ["en", "ru"],
    },
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#org`,
      name: SITE.name,
      url: SITE.url,
      slogan: SITE.tagline,
      description:
        "no reality. runs two feeds: an endless stream of curated AI video, and blind raffles where every clip is either REAL footage or a machine dream — call it, stake $1–5, win the pool.",
      sameAs: SOCIALS.map((s) => s.url),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      mainEntity: HUB_FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Landing />
    </>
  );
}
