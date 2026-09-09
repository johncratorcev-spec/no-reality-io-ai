import Header from "@/components/Header";
import WebGLBanner from "@/components/WebGLBanner";
import Feed from "@/components/feed/Feed";
import Footer from "@/components/Footer";
import { getRankedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const posts = await getRankedPosts();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <Header />
      <WebGLBanner />

      <main className="relative min-h-0 flex-1">
        <Feed posts={posts} />
      </main>

      <Footer />
    </div>
  );
}
