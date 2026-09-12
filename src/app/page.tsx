import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";
import { FAQ_ITEMS } from "@/components/landing/faq";
import { SITE, SOCIALS } from "@/lib/site";

/**
 * Главная = лендинг (статика, идеальна для SEO/GEO).
 * Лента живёт на /feed, deep-link'и — /v/[code] (рендерят ту же ленту).
 *
 * JSON-LD внизу страницы: WebSite + Organization (соцсети) + FAQPage —
 * Google Rich Results и генеративные движки (AI Overviews, Perplexity)
 * вытаскивают факты прямо из этих структурированных данных.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: SITE.title,
  description: SITE.description,
  keywords: [
    "AI video feed",
    "AI generated videos",
    "prompt marketplace",
    "buy AI video prompts",
    "Threads AI video",
    "Veo prompts",
    "AI video curation",
    "swag AI video",
    "creepy AI video",
    "USDT creator payouts",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
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
      inLanguage: "en",
    },
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#org`,
      name: SITE.name,
      url: SITE.url,
      slogan: SITE.tagline,
      description:
        "Decentralized curation crew building a discovery feed for AI-generated video and a prompt marketplace.",
      sameAs: SOCIALS.map((s) => s.url),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      mainEntity: FAQ_ITEMS.map((f) => ({
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
