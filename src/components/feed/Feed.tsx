"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import VideoCard, { type PostWithScore } from "./VideoCard";

interface FeedProps {
  posts: PostWithScore[];
}

/**
 * Pure vertical scroll лента (snap-scroll).
 * Активная карточка определяется IntersectionObserver'ом,
 * по окончании видео — мягкий автопереход к следующей.
 */
export default function Feed({ posts }: FeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
          <p className="text-lg font-bold tracking-tight">лента пуста</p>
          <p className="mt-2 text-sm text-[#10161d]/60">
            добавь посты в <code className="font-mono">/data/posts.csv</code> —
            и они появятся здесь
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
      aria-label="Лента видео"
      className="nr-feed h-full w-full snap-y snap-mandatory overflow-y-auto outline-none"
    >
      {posts.map((post, i) => (
        <VideoCard
          key={post.utmCode}
          post={post}
          index={i}
          total={posts.length}
          isActive={i === activeIndex}
          onEnded={() => handleEnded(i)}
        />
      ))}
    </div>
  );
}
