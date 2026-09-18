import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import FeedScreen from "@/components/FeedScreen";
import { getRankedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ donate?: string }>;
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

  if (!post) return { title: "видео не найдено — no reality." };

  return {
    title: `${post.author || "video"} — no reality.`,
    description: post.title
      ? post.title.slice(0, 160)
      : "AI-видео из живой ленты no reality.",
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

  /* ?donate=1 — виральный deep-link с коллаб-страницы: донат открывается сам */
  const donateOpen = sp.donate === "1";

  return <FeedScreen posts={posts} focusCode={post.utmCode} donateOpen={donateOpen} />;
}
