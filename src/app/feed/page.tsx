import FeedScreen from "@/components/FeedScreen";
import { getRankedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "the feed — no reality.",
  description:
    "The living feed of AI-generated video from Threads. Full-screen, ranked by real attention, with shareable deep links.",
};

/** Лента переехала с / на /feed — главная теперь лендинг (src/app/page.tsx). */
export default async function FeedPage() {
  const posts = await getRankedPosts();

  return <FeedScreen posts={posts} />;
}
