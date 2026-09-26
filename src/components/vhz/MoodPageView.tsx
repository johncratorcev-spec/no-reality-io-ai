import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Mosaic from "@/components/vhz/Mosaic";
import { Reveal } from "@/components/vhz/Mascots";
import { getMood, type MoodKey } from "@/lib/moods";
import { getRankedPosts, toClientRankedPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

interface MoodPageViewProps {
  moodKey: MoodKey;
}

export default async function MoodPageView({ moodKey }: MoodPageViewProps) {
  const m = getMood(moodKey);
  if (!m) notFound();

  const posts = (await getRankedPosts()).filter((p) => p.mood === m.key);
  const clientPosts = toClientRankedPosts(posts);

  /* GEO: ItemList канала — движки видят живой каталог настроения */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: m.en.title,
        description: m.en.blurb,
        url: `${SITE.url}/moods/${m.key}`,
        inLanguage: ["en", "ru"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "no reality.", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "the mosaic", item: `${SITE.url}/feed` },
          { "@type": "ListItem", position: 3, name: m.en.label, item: `${SITE.url}/moods/${m.key}` },
        ],
      },
      {
        "@type": "ItemList",
        numberOfItems: clientPosts.length,
        itemListElement: clientPosts.slice(0, 40).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.title || `clip ${p.utmCode}`,
          url: `${SITE.url}/v/${p.utmCode}`,
        })),
      },
    ],
  };

  return (
    <div className="vhz-page min-h-dvh">
      <div className="vhz-tracking" aria-hidden />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav aria-label="breadcrumb" className="vhz-mono mb-5 text-[0.7rem] tracking-[0.14em] text-[var(--vhz-faint)] uppercase">
            <Link href="/feed" className="hover:text-[var(--vhz-yellow)]">the mosaic</Link>
            <span className="mx-2">/</span>
            <span style={{ color: m.color }}>{m.en.label}</span>
          </nav>

          <Reveal>
            <h1
              className="vhz-display vhz-glitchy text-4xl font-extrabold sm:text-5xl"
              style={{ color: m.color, textShadow: "-2px 0 0 rgba(0,229,255,.5), 2px 0 0 rgba(255,43,166,.5)" }}
            >
              {m.glyph} {m.en.label}
            </h1>
            <p className="vhz-display mt-3 text-xl font-bold text-[var(--vhz-paper)] sm:text-2xl">
              {m.ru.title}
            </p>
            <p className="mt-4 max-w-3xl leading-relaxed text-[var(--vhz-dim)]">{m.en.blurb}</p>
            <p className="vhz-mono mt-3 max-w-3xl border-t border-dashed border-[var(--vhz-line)] pt-3 text-[0.86rem] leading-relaxed text-[var(--vhz-faint)]">
              {m.ru.blurb}
            </p>
          </Reveal>
        </div>

        <div className="mt-8">
          <Mosaic posts={clientPosts} hideFilters />
        </div>
      </main>

      <Footer />
    </div>
  );
}
