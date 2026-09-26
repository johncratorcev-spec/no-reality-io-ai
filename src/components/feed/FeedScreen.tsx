import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClipFeed from "@/components/feed/ClipFeed";
import type { ClipMode } from "@/components/feed/ClipCard";
import type { ClientRankedPost } from "@/lib/posts";

interface FeedScreenProps {
  posts: ClientRankedPost[];
  mode: ClipMode;
  /** utm-код поста, к которому лента проскроллится при загрузке (/v/[code]) */
  focusCode?: string;
}

/**
 * Единый каркас экрана ленты (v4): шапка + бесконечный фид + футер.
 * mode="watch" — просто бесконечные ИИ-видео;
 * mode="bet"   — рафлы «угадай, ИИ или нет» (BetPanel у активной карточки).
 * Используется на /feed, /bet и deep-link странице /v/[code].
 */
export default function FeedScreen({ posts, mode, focusCode }: FeedScreenProps) {
  return (
    <div className="nr-night flex h-dvh flex-col overflow-hidden bg-[#0A0A0F] text-[#F2EDE4]">
      <Header />
      <main className="relative min-h-0 flex-1">
        <ClipFeed posts={posts} mode={mode} focusCode={focusCode} />
      </main>
      <Footer />
    </div>
  );
}
