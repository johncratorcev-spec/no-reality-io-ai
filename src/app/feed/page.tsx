import type { Metadata } from "next";
import FeedScreen from "@/components/feed/FeedScreen";
import { getRankedPosts, toClientRankedPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/* Лента v4 = бесконечный поток ИИ-видео (Threads/Instagram) — просто смотри.
   Рафлы «угадай, ИИ или нет» живут на /bet, deep-link'и — /v/[code]. */

export const metadata: Metadata = {
  title: "the feed — an endless stream of AI videos",
  description:
    "An infinite vertical feed of synthetic cinema: machine dreams and terrifyingly real footage from Threads and Instagram, curated by a roost of crows. No account, no paywall — just watch.",
  alternates: {
    canonical: "/feed",
    languages: { en: "/feed", ru: "/feed?lang=ru", "x-default": "/feed" },
  },
  openGraph: {
    title: "the feed — watch what shouldn’t exist",
    description:
      "An endless stream of curated AI video. When you’re ready to test your eye — the raffles are one tap away.",
    url: "/feed",
    type: "website",
    images: ["/images/og-vhs.png"],
  },
};

export default async function FeedPage() {
  const posts = await getRankedPosts();
  const clientPosts = toClientRankedPosts(posts);

  /* ItemList (GEO): генеративные движки получают каталог клипов;
     truth по-прежнему не покидает сервер. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "the feed — no reality.",
    url: `${SITE.url}/feed`,
    description:
      "An endless curated stream of AI-generated and real video clips; viewers can switch to the raffle feed to call each clip REAL or SYNTH.",
    inLanguage: ["en", "ru"],
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: clientPosts.length,
      itemListElement: clientPosts.slice(0, 50).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title || `clip ${p.utmCode}`,
        url: `${SITE.url}/v/${p.utmCode}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FeedScreen posts={clientPosts} mode="watch" />
    </>
  );
}
