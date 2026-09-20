import type { Metadata } from "next";
import FeedScreen from "@/components/FeedScreen";
import { getRankedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "the feed",
  description:
    "The living feed of AI-generated video from Threads. Full-screen, ranked by real attention, with Cryo-Stop prediction markets and shareable deep links.",
  alternates: { canonical: "/feed" },
  openGraph: {
    title: "the feed — AI video, frozen mid-play",
    description:
      "Full-screen AI video ranked by real attention. Watch 5 seconds, the clip freezes, call the ending — YES or NO — and split the pool.",
    url: "/feed",
    type: "website",
    images: ["/images/og-cover.png"],
  },
};

/** Лента переехала с / на /feed — главная теперь лендинг (src/app/page.tsx). */
export default async function FeedPage() {
  const posts = await getRankedPosts();

  return <FeedScreen posts={posts} />;
}
