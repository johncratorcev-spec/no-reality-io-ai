import Header from "@/components/Header";
import WebGLBanner from "@/components/WebGLBanner";
import Feed from "@/components/feed/Feed";
import Footer from "@/components/Footer";
import { getPostsFromCSV } from "@/lib/csv";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  // CSV + score из БД, сортировка по рейтингу уникальных кликов
  const posts = getPostsFromCSV();

  const stats = await db.postStats.findMany({
    where: { utmCode: { in: posts.map((p) => p.utmCode) } },
  });
  const scoreMap = new Map(stats.map((s) => [s.utmCode, s.score]));

  const ranked = posts
    .map((p) => ({ ...p, score: scoreMap.get(p.utmCode) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <Header />
      <WebGLBanner />

      <main className="relative min-h-0 flex-1">
        <Feed posts={ranked} />
      </main>

      <Footer />
    </div>
  );
}
