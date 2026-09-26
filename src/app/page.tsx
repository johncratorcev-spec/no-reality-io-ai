import type { Metadata } from "next";
import Hub from "@/components/vhz/Hub";
import { HUB_FAQ } from "@/lib/hubFaq";
import { MOODS } from "@/lib/moods";
import { SITE, SOCIALS } from "@/lib/site";

/**
 * Главная = хаб-лендинг (v3, статика — идеальна для SEO/GEO).
 * Мозаика живёт на /feed, deep-link'и — /v/[code], театр = один клип.
 *
 * JSON-LD: WebSite + Organization + FAQPage (EN) — Google Rich Results
 * и генеративные движки (AI Overviews, Perplexity, ChatGPT search)
 * вытаскивают факты хаба из структурированных данных.
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
    "prediction game",
    "pari-mutuel betting",
    "crypto predictions",
    "prompt market",
    "Veo prompts",
    "интерактивный хаб",
    "AI-контент",
    "предсказания реал или синтик",
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
        alt: "no reality. — interactive hub of AI content & predictions",
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
        "Interactive hub of AI content & predictions: a mosaic of synthetic cinema where every clip is either real footage or a machine dream — watch, call REAL or SYNTH, win the pool.",
      sameAs: SOCIALS.map((s) => s.url),
    },
    {
      "@type": "ItemList",
      "@id": `${SITE.url}/#moods`,
      name: "Mood channels of the hub",
      itemListElement: MOODS.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: m.en.label,
        description: m.en.blurb,
        url: `${SITE.url}/moods/${m.key}`,
      })),
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
      <Hub />
    </>
  );
}
