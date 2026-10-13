import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClipFeed from "@/components/feed/ClipFeed";
import PoolsBoot from "@/components/bet/PoolsBoot";
import { realtimeConf } from "@/lib/realtime";
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
 * Используется на /bet и deep-link странице /v/[code].
 *
 * v23 — realtime пулов: RSC читает серверные SUPABASE_URL/ANON_KEY и
 * передаёт их бутстрапу канала (анон-ключ публичен по дизайну Supabase).
 * Нет ключей → бутстрап пустой, поллинг страхует.
 */
export default function FeedScreen({ posts, mode, focusCode }: FeedScreenProps) {
  const rt = mode === "bet" ? realtimeConf() : null;
  return (
    <div className="nr-night flex h-dvh flex-col overflow-hidden bg-[#0A0A0F] text-[#F2EDE4]">
      {rt && <PoolsBoot url={rt.url} k={rt.key} />}
      <Header />
      <main className="relative min-h-0 flex-1">
        <ClipFeed posts={posts} mode={mode} focusCode={focusCode} />
      </main>
      <Footer />
    </div>
  );
}
