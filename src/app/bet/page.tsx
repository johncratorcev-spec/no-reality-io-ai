import type { Metadata } from "next";
import FeedScreen from "@/components/feed/FeedScreen";
import { getRankedPosts, toClientRankedPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/* РАФЛЫ (v23): лента ставок — ВСЕ видео и карусели одновременно.
   Каждый клип — раффл с недельным окном: пул копится неделю,
   авторезолв по истечении, победители делят банк pari-mutuel. */

export const metadata: Metadata = {
  title: "the raffles — call it: AI or not?",
  description:
    "Blind raffles on synthetic cinema: no titles, no authors — just the footage. Call REAL or SYNTH, stake 10–50 EYE into the pari-mutuel bank. Every clip runs as a raffle for a week, then the verdict auto-resolves and winners split the pool. Your eyes vs the machine.",
  alternates: {
    canonical: "/bet",
    languages: { en: "/bet", ru: "/bet?lang=ru", "x-default": "/bet" },
  },
  openGraph: {
    title: "the raffles — REAL or SYNTH?",
    description:
      "No hints. Pure eye. Call REAL or SYNTH, stake 10–50 EYE. Every raffle lives a week, the verdict auto-drops, winners split the bank.",
    url: "/bet",
    type: "website",
    images: ["/images/og-vhs.png"],
  },
};

export default async function BetPage() {
  const posts = await getRankedPosts();
  /* v23 — ВЕСЬ контент в ленте ставок: каждое видео и карусель — раффл
     со своим недельным окном. Ставочные (live) идут первыми, resolved
     витриной с вердиктами следом. queued (ещё не открыт планировщиком)
     и void не показываем. truth вырезан до клиента — bettable не
     раскрывает, КАКАЯ правда. */
  const all = toClientRankedPosts(posts);
  const feed = [
    ...all.filter((p) => p.status === "live"),
    ...all.filter((p) => p.status === "resolved"),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "the raffles — no reality.",
        url: `${SITE.url}/bet`,
        description:
          "Blind prediction raffles on AI-generated and real video clips: call REAL or SYNTH, stake 10–50 EYE, winners split the pari-mutuel pool when the week-long raffle auto-resolves.",
        inLanguage: ["en", "ru"],
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: feed.length,
          itemListElement: feed.slice(0, 50).map((p, i) => ({
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
          "Watch a clip, call REAL or SYNTH, stake 10–50 EYE into the pari-mutuel bank and split the pool when the week-long raffle auto-resolves.",
        inLanguage: "en",
        step: [
          { "@type": "HowToStep", position: 1, name: "Watch the clip", text: "A short clip plays with no titles and no hints — real footage or a machine dream." },
          { "@type": "HowToStep", position: 2, name: "Call REAL or SYNTH", text: "Decide what you are looking at and pick your side." },
          { "@type": "HowToStep", position: 3, name: "Stake 10–50 EYE", text: "Put 10, 25 or 50 EYE game points on your call — the stake drops into the shared pari-mutuel bank." },
          { "@type": "HowToStep", position: 4, name: "Split the bank", text: "Every raffle lives a week; when it auto-resolves, the losing side's bank is split pari-mutuel among winners — straight to your balance." },
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
      <FeedScreen posts={feed} mode="bet" />
    </>
  );
}
