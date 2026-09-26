import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import TheaterScreen from "@/components/vhz/TheaterScreen";
import { getRankedPosts, toClientRankedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ donate?: string; drop?: string }>;
}

/* кэш на один запрос: generateMetadata и страница делят один fetch */
const getFeed = cache(getRankedPosts);

async function findPost(code: string) {
  const posts = await getFeed();
  return posts.find((p) => p.utmCode === code);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  const post = await findPost(code.trim());

  if (!post) return { title: "video not found", robots: { index: false } };

  /* v2 (§4.3.1 deep link first): OG-карточка = «REAL or SYNTH?» + кадр.
     В v3 карточка ведёт в театр: суд + ставка на одном экране. */
  const t = post.title ? post.title.slice(0, 160) : undefined;
  return {
    title: `REAL or SYNTH? — ${post.author || "video"}`.slice(0, 120),
    description: t
      ? `${t.slice(0, 110)} — real or synth? call it and win the pool.`
      : "real or synth? call it — $1–5, the bank resolves in under a minute.",
    alternates: { canonical: `/v/${post.utmCode}` },
    openGraph: {
      title: `REAL or SYNTH? — ${post.author || "video"} on no reality.`,
      description: t
        ? `${t.slice(0, 110)} — real or synth? call it and win the pool.`
        : "real or synth? call it and win the pool.",
      url: `/v/${post.utmCode}`,
      type: "article",
      images: ["/images/og-vhs.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `REAL or SYNTH? — ${post.author || "video"}`,
      description: t
        ? `${t.slice(0, 110)} — real or synth? call it and win the pool.`
        : "real or synth? call it and win the pool.",
    },
  };
}

/**
 * ТЕАТР (v3): deep-link /v/[utmCode] = один клип на весь экран
 * (BetPanel/CryoStopCard внутри) + полоса «ещё из мозаики».
 * Полный грид-дискавери — на /feed (мозаика).
 */
export default async function VideoByCodePage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const sp = await searchParams;
  const posts = await getFeed();
  const post = posts.find((p) => p.utmCode === code.trim());

  if (!post) notFound();

  /* ?donate=1 — виральный deep-link с коллаб-страницы: донат открывается сам.
     ?drop=1 устарел (v2) — принимается, игнорируется. */
  const donateOpen = sp.donate === "1";

  return (
    <TheaterScreen
      posts={toClientRankedPosts(posts)}
      focusCode={post.utmCode}
      donateOpen={donateOpen}
    />
  );
}
