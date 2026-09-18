"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import VideoCard, { type PostWithScore } from "./VideoCard";

interface FeedProps {
  posts: PostWithScore[];
  /** utm-код поста с deep-link страницы /v/[code] — к нему прыгаем при монтировании */
  focusCode?: string;
  /** deep-link ?donate=1: авто-открыть донат на сфокусированной карточке */
  donateOpen?: boolean;
}

/**
 * Pure vertical scroll лента (snap-scroll).
 * Активная карточка определяется IntersectionObserver'ом,
 * по окончании видео — мягкий автопереход к следующей.
 *
 * Deep-link (/v/[code]): начальный активный индекс берётся из focusCode,
 * а адресная строка всегда синхронизируется с активным видео
 * (history.replaceState — без записей в истории, Next это поддерживает).
 */
export default function Feed({ posts, focusCode, donateOpen }: FeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(() => {
    if (!focusCode) return 0;
    const i = posts.findIndex((p) => p.utmCode === focusCode);
    return i >= 0 ? i : 0;
  });

  /* мгновенный прыжок к запрошенному видео после монтирования
     (behavior по умолчанию — auto, без плавной прокрутки через всю ленту;
      активный индекс уже установлен выше — нужное видео монтируется сразу) */
  useEffect(() => {
    if (!focusCode) return;
    const idx = posts.findIndex((p) => p.utmCode === focusCode);
    if (idx <= 0) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${idx}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [focusCode, posts]);

  /* адресная строка всегда указывает на активное видео.
     Первый запуск пропускаем: на /v/[code] URL уже верный,
     на / пока пользователь не листал — не трогаем адрес. */
  const skipUrlSync = useRef(true);
  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false;
      return;
    }
    const post = posts[activeIndex];
    if (!post) return;
    const url = `/v/${post.utmCode}`;
    if (window.location.pathname !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [activeIndex, posts]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root, threshold: [0.55, 0.9] }
    );

    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts.length]);

  const goTo = useCallback((idx: number) => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-index="${idx}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleEnded = useCallback(
    (idx: number) => {
      if (idx < posts.length - 1) goTo(idx + 1);
    },
    [posts.length, goTo]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      goTo(Math.min(activeIndex + 1, posts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      goTo(Math.max(activeIndex - 1, 0));
    }
  };

  if (posts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="nr-glass-deep max-w-sm rounded-3xl px-8 py-10 text-center">
          <p className="text-lg font-bold tracking-tight">the feed is empty</p>
          <p className="mt-2 text-sm text-[#10161d]/60">
            add posts to <code className="font-mono">/data/posts.csv</code> —
            they will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Video feed"
      className="nr-feed h-full w-full snap-y snap-mandatory overflow-y-auto outline-none"
    >
      {posts.map((post, i) => (
        <VideoCard
          key={post.utmCode}
          post={post}
          index={i}
          total={posts.length}
          isActive={i === activeIndex}
          shouldLoad={Math.abs(i - activeIndex) <= 1}
          /* следующее видео грузим полностью — переход мгновенный */
          eagerPreload={i === activeIndex + 1}
          autoDonate={donateOpen === true && post.utmCode === focusCode}
          onEnded={() => handleEnded(i)}
        />
      ))}
    </div>
  );
}
