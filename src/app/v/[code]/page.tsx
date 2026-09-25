import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import FeedScreen from "@/components/FeedScreen";
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

  /* v2 (§4.3.1 deep link first): OG-карточка = кадр + «REAL or SYNTH?» +
     текущий банк. Банк живёт на клиенте (карточка), в статику не вытащить —
     поэтому в мете сам вопрос и ставка; банк подгревает первый экран. */
  const t = post.title ? post.title.slice(0, 160) : undefined;
  return {
    title: `REAL or SYNTH? — ${post.author || "video"}`.slice(0, 120),
    description:
      t
        ? `${t.slice(0, 110)} — real or synth? bet the seam.`
        : "real or synth? bet the seam — $1–5, the bank resolves in under a minute.",
    alternates: { canonical: `/v/${post.utmCode}` },
    openGraph: {
      title: `REAL or SYNTH? — ${post.author || "video"} on no reality.`,
      description: t
        ? `${t.slice(0, 110)} — real or synth? bet the seam.`
        : "real or synth? bet the seam.",
      url: `/v/${post.utmCode}`,
      type: "article",
      images: ["/images/og-cover.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `REAL or SYNTH? — ${post.author || "video"}`,
      description: t
        ? `${t.slice(0, 110)} — real or synth? bet the seam.`
        : "real or synth? bet the seam.",
    },
  };
}

/**
 * Deep-link на конкретное видео: /v/[utmCode].
 * Рендерим ту же ленту (чтобы соседние видео оставались доступными),
 * а Feed сам проскроллится к запрошенному посту и синхронизирует адрес.
 */
export default async function VideoByCodePage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const sp = await searchParams;
  const posts = await getFeed();
  const post = posts.find((p) => p.utmCode === code.trim());

  if (!post) notFound();

  /* ?donate=1 — виральный deep-link с коллаб-страницы: донат открывается сам.
     ?drop=1 — возврат с чекаута prompt drop: лента прыгает на рекламную карточку,
     где session-инвойс поллит статус и сам раскрывает промпт. */
  const donateOpen = sp.donate === "1";
  const dropOpen = sp.drop === "1";

  return (
    <FeedScreen
      posts={toClientRankedPosts(posts)}
      focusCode={post.utmCode}
      donateOpen={donateOpen}
      dropOpen={dropOpen}
    />
  );
}
