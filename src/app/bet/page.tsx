import type { Metadata } from "next";
import FeedScreen from "@/components/feed/FeedScreen";
import { getRankedPosts, toClientRankedPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/* РАФЛЫ (v4): вторая лента сайта. Слепой суд — метаданных нет,
   смотри кадр и ставь на REAL или SYNTH (10–50 EYE), банк pari-mutuel
   закрывается меньше чем за минуту. Чистое угадывание. */

export const metadata: Metadata = {
  title: "the raffles — call it: AI or not?",
  description:
    "Blind raffles on synthetic cinema: no titles, no authors — just the footage. Call REAL or SYNTH, stake 10–50 EYE into the pari-mutuel bank and split the pool when the verdict lands in under a minute. Your eyes vs the machine.",
  alternates: {
    canonical: "/bet",
    languages: { en: "/bet", ru: "/bet?lang=ru", "x-default": "/bet" },
  },
  openGraph: {
    title: "the raffles — REAL or SYNTH?",
    description:
      "No hints. Pure eye. Call REAL or SYNTH, stake 10–50 EYE, split the bank. The verdict drops in under a minute.",
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
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "the raffles — no reality.",
        url: `${SITE.url}/bet`,
        description:
          "Blind prediction raffles on AI-generated and real video clips: call REAL or SYNTH, stake 10–50 EYE, winners split the pari-mutuel pool.",
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
      },
      {
        "@type": "HowTo",
        name: "How to play REAL or SYNTH on no reality.",
        description:
          "Watch a clip, call REAL or SYNTH, stake 10–50 EYE into the pari-mutuel bank and split the pool when the verdict lands.",
        inLanguage: "en",
        step: [
          { "@type": "HowToStep", position: 1, name: "Watch the clip", text: "A short clip plays with no titles and no hints — real footage or a machine dream." },
          { "@type": "HowToStep", position: 2, name: "Call REAL or SYNTH", text: "Decide what you are looking at and pick your side." },
          { "@type": "HowToStep", position: 3, name: "Stake 10–50 EYE", text: "Put 10, 25 or 50 EYE game points on your call — the stake drops into the shared pari-mutuel bank." },
          { "@type": "HowToStep", position: 4, name: "Split the bank", text: "When the verdict lands, the losing side's bank is split pari-mutuel among winners — straight to your balance." },
        ],
      },
    ],
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
