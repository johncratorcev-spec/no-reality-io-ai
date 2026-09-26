import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import FeedScreen from "@/components/feed/FeedScreen";
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

  /* deep link first: OG-карточка = «REAL or SYNTH?» + кадр */
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
 * Deep-link /v/[utmCode] (v4): лента, приземляющаяся на этот клип.
 * Ставочный клип → рафл (слепой суд + BetPanel), обычный → чистый просмотр.
 */
export default async function VideoByCodePage({ params }: PageProps) {
  const { code } = await params;
  const posts = await getFeed();
  const post = posts.find((p) => p.utmCode === code.trim());

  if (!post) notFound();

  /* searchParams ?donate/?drop устарели — принимаются молча, игнорируются */

  return (
    <FeedScreen
      posts={toClientRankedPosts(
        post.truth ? posts.filter((p) => p.truth) : posts
      )}
      mode={post.truth ? "bet" : "watch"}
      focusCode={post.utmCode}
    />
  );
}
