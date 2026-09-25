import Header from "@/components/Header";
import WebGLBanner from "@/components/WebGLBanner";
import Feed from "@/components/feed/Feed";
import Footer from "@/components/Footer";
import type { ClientRankedPost } from "@/lib/posts";

interface FeedScreenProps {
  posts: ClientRankedPost[];
  /** utm-код поста, к которому лента должна проскроллиться при загрузке (/v/[code]) */
  focusCode?: string;
  /** deep-link ?donate=1 — авто-открыть карточку доната на сфокусированном посте */
  donateOpen?: boolean;
  /** deep-link ?drop=1 — авто-прыжок на рекламную карточку prompt drop после сфокусированного поста */
  dropOpen?: boolean;
}

/**
 * Единый каркас экрана ленты: баннер + лента + футер.
 * Используется и на главной /, и на deep-link странице /v/[code] —
 * чтобы обе точки входа всегда выглядели и вели себя одинаково.
 */
export default function FeedScreen({
  posts,
  focusCode,
  donateOpen,
  dropOpen,
}: FeedScreenProps) {
  return (
    <div className="nr-night flex h-dvh flex-col overflow-hidden bg-[#0A0A0F] text-[#F2EDE4]">
      <Header />
      <WebGLBanner />

      <main className="relative min-h-0 flex-1">
        <Feed
          posts={posts}
          focusCode={focusCode}
          donateOpen={donateOpen}
          dropOpen={dropOpen}
        />
      </main>

      <Footer />
    </div>
  );
}
