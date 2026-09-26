"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClipCard, { type ClipMode } from "./ClipCard";
import type { ClientRankedPost } from "@/lib/posts";

interface ClipFeedProps {
  posts: ClientRankedPost[];
  mode: ClipMode;
  /** deep-link /v/[code]: к этому посту прыгаем при монтировании и синхронизируем адрес */
  focusCode?: string;
}

/**
 * ClipFeed — бесконечная вертикальная лента (snap-scroll), v4.
 * Легаси-поллеры (cryo/favorites) вырезаны: фид стал чистым и лёгким.
 * Активная карточка — IntersectionObserver; по окончании видео —
 * мягкий автопереход к следующей; стрелки ↑/↓ листают.
 */
export default function ClipFeed({ posts, mode, focusCode }: ClipFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const findIndex = useCallback(
    (code: string) => posts.findIndex((p) => p.utmCode === code),
    [posts]
  );

  const [activeIndex, setActiveIndex] = useState(() => {
    if (!focusCode) return 0;
    const i = findIndex(focusCode);
    return i >= 0 ? i : 0;
  });

  /* мгновенный прыжок к deep-link посту после монтирования */
  useEffect(() => {
    if (!focusCode) return;
    const idx = findIndex(focusCode);
    if (idx <= 0) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${idx}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [focusCode, findIndex]);

  /* адресная строка синхронизируется только на deep-link странице
     (/v/[code]) — на /feed и /bet адрес остаётся чистым */
  const skipUrlSync = useRef(true);
  useEffect(() => {
    if (!focusCode) return;
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
  }, [activeIndex, posts, focusCode]);

  /* активная карточка — по пересечению ≥55% */
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
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${idx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const slots = useMemo(() => posts, [posts]);

  if (posts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-sm rounded-3xl border border-white/10 bg-[rgba(16,13,22,0.8)] px-8 py-10 text-center backdrop-blur-md">
          <p className="text-lg font-extrabold tracking-tight text-white">the feed is empty</p>
          <p className="mt-2 text-sm font-semibold text-white/55">
            add clips to <code className="font-mono text-white/75">/data/posts.csv</code> — they
            will appear here
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
      aria-label={mode === "bet" ? "Raffle feed" : "Video feed"}
      className="nr-feed h-full w-full snap-y snap-mandatory overflow-y-auto outline-none"
    >
      {slots.map((post, i) => (
        <ClipCard
          key={post.utmCode}
          post={post}
          index={i}
          total={slots.length}
          isActive={i === activeIndex}
          shouldLoad={Math.abs(i - activeIndex) <= 1}
          /* следующее видео грузим полностью — переход мгновенный */
          eagerPreload={i === activeIndex + 1}
          mode={mode}
          onEnded={handleEnded}
        />
      ))}
    </div>
  );
}
