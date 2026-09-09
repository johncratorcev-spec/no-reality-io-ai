import FeedScreen from "@/components/FeedScreen";
import { getRankedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const posts = await getRankedPosts();

  return <FeedScreen posts={posts} />;
}
