import type { Metadata } from "next";
import FeedScreen from "@/components/feed/FeedScreen";
import { getRankedPosts, toClientRankedPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/* РАФЛЫ (v4): вторая лента сайта. Слепой суд — метаданных нет,
   смотри кадр и ставь на REAL или SYNTH ($1–5), банк pari-mutuel
   закрывается меньше чем за минуту. Чистое угадывание. */

export const metadata: Metadata = {
  title: "the raffles — call it: AI or not?",
  description:
    "Blind raffles on synthetic cinema: no titles, no authors — just the footage. Call REAL or SYNTH, stake $1–5 into the pari-mutuel bank and split the pool when the curator’s verdict lands in under a minute.",
  alternates: {
    canonical: "/bet",
    languages: { en: "/bet", ru: "/bet?lang=ru", "x-default": "/bet" },
  },
  openGraph: {
    title: "the raffles — REAL or SYNTH?",
    description:
      "No hints. Pure eye. Call REAL or SYNTH, stake $1–5, split the bank. The verdict drops in under a minute.",
    url: "/bet",
    type: "website",
    images: ["/images/og-vhs.png"],
  },
};

export default async function BetPage() {
  const posts = await getRankedPosts();
  /* только ставочные клипы (кураторская правда существует);
     truth вырезан до клиента — bettable не раскрывает, КАКАЯ правда */
  const bettable = toClientRankedPosts(posts).filter((p) => p.bettable);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "the raffles — no reality.",
    url: `${SITE.url}/bet`,
    description:
      "Blind prediction raffles on AI-generated and real video clips: call REAL or SYNTH, stake $1–5, winners split the pari-mutuel pool.",
    inLanguage: ["en", "ru"],
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: bettable.length,
      itemListElement: bettable.slice(0, 50).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `raffle ${p.utmCode}`,
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
      <FeedScreen posts={bettable} mode="bet" />
    </>
  );
}
