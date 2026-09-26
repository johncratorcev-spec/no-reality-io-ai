import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Mosaic from "@/components/vhz/Mosaic";
import { getRankedPosts, toClientRankedPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/* Лента v3 = МОЗАИКА: грид-дискавери с фильтрами настроений и
   слепым судом. Полный экран проигрывания живёт в театре /v/[code]. */

export const metadata: Metadata = {
  title: "the mosaic — AI clips, real or synth?",
  description:
    "The mosaic of no reality.: machine dreams and real footage shuffled into one grid. Filter by mood, flip on blind court, open a clip and call REAL or SYNTH — the bank resolves in under a minute.",
  alternates: {
    canonical: "/feed",
    languages: { en: "/feed", ru: "/feed?lang=ru", "x-default": "/feed" },
  },
  openGraph: {
    title: "the mosaic — watch what shouldn’t exist",
    description:
      "AI clips & real footage, shuffled. Call REAL or SYNTH, stake $1–5, split the pool.",
    url: "/feed",
    type: "website",
    images: ["/images/og-vhs.png"],
  },
};

export default async function FeedPage() {
  const posts = await getRankedPosts();
  const clientPosts = toClientRankedPosts(posts);

  /* ItemList (GEO): генеративные движки получают каталог клипов с
     настроениями и ссылками на суд; truth по-прежнему не покидает сервер. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "the mosaic — no reality.",
    url: `${SITE.url}/feed`,
    description:
      "A curated mosaic of AI-generated and real video clips; judges call each clip REAL or SYNTH.",
    inLanguage: ["en", "ru"],
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: clientPosts.length,
      itemListElement: clientPosts.slice(0, 50).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title || `clip ${p.utmCode}`,
        url: `${SITE.url}/v/${p.utmCode}`,
        ...(p.mood ? { genre: p.mood } : {}),
      })),
    },
  };

  return (
    <div className="vhz-page flex min-h-dvh flex-col">
      <div className="vhz-tracking" aria-hidden />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="flex-1 pt-8">
        <div className="mx-auto max-w-7xl px-4 pb-2 sm:px-6">
          <h1 className="vhz-display vhz-cmyk vhz-glitchy text-3xl font-extrabold sm:text-4xl">
            the mosaic
          </h1>
          <p className="vhz-mono mt-2 text-[0.74rem] tracking-[0.18em] text-[var(--vhz-dim)] uppercase">
            machine dreams &amp; real footage, shuffled
          </p>
        </div>
        <Mosaic posts={clientPosts} />
      </main>
      <Footer />
    </div>
  );
}
