"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoCard, { type PostWithScore } from "./VideoCard";
import PromptDropCard from "./PromptDropCard";
import { PROMPT_DROP } from "@/lib/site";

type Slot =
  | { kind: "post"; post: PostWithScore }
  | { kind: "ad" };

interface FeedProps {
  posts: PostWithScore[];
  /** utm-код поста с deep-link страницы /v/[code] — к нему прыгаем при монтировании */
  focusCode?: string;
  /** deep-link ?donate=1: авто-открыть донат на сфокусированной карточке */
  donateOpen?: boolean;
  /** deep-link ?drop=1: авто-прыжок на рекламную карточку prompt drop после сфокусированного поста */
  dropOpen?: boolean;
}

/**
 * Pure vertical scroll лента (snap-scroll).
 * Активная карточка определяется IntersectionObserver'ом,
 * по окончании видео — мягкий автопереход к следующей.
 *
 * Слоты: между постами вставляется рекламная карточка prompt drop
 * (после поста PROMPT_DROP.afterUtm). Слот-реклама участвует в
 * навигации, но не меняет адресную строку и не играет видео.
 *
 * Deep-link (/v/[code]): начальный активный индекс берётся из focusCode,
 * а адресная строка всегда синхронизируется с активным видео
 * (history.replaceState — без записей в истории, Next это поддерживает).
 */
export default function Feed({ posts, focusCode, donateOpen, dropOpen }: FeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const slots = useMemo<Slot[]>(() => {
    const s: Slot[] = [];
    for (const post of posts) {
      s.push({ kind: "post", post });
      if (post.utmCode === PROMPT_DROP.afterUtm) s.push({ kind: "ad" });
    }
    return s;
  }, [posts]);

  const findPostSlot = useCallback(
    (code: string) =>
      slots.findIndex(
        (s) => s.kind === "post" && s.post.utmCode === code
      ),
    [slots]
  );

  const findAdAfterPost = useCallback(
    (code: string) => {
      for (let i = 1; i < slots.length; i++) {
        const s = slots[i];
        const prev = slots[i - 1];
        if (
          s.kind === "ad" &&
          prev.kind === "post" &&
          prev.post.utmCode === code
        ) {
          return i;
        }
      }
      return -1;
    },
    [slots]
  );

  const [activeIndex, setActiveIndex] = useState(() => {
    if (dropOpen && focusCode) {
      const ad = findAdAfterPost(focusCode);
      if (ad > 0) return ad;
    }
    if (!focusCode) return 0;
    const i = findPostSlot(focusCode);
    return i >= 0 ? i : 0;
  });

  /* мгновенный прыжок к запрошенному видео после монтирования
     (behavior по умолчанию — auto, без плавной прокрутки через всю ленту;
      активный индекс уже установлен выше — нужное видео монтируется сразу) */
  useEffect(() => {
    if (!focusCode) return;
    const idx = dropOpen
      ? findAdAfterPost(focusCode)
      : findPostSlot(focusCode);
    if (idx <= 0) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${idx}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [focusCode, dropOpen, findAdAfterPost, findPostSlot]);

  /* адресная строка всегда указывает на активное видео.
     Первый запуск пропускаем: на /v/[code] URL уже верный,
     на / пока пользователь не листал — не трогаем адрес.
     Слот-реклама адрес не меняет: предыдущий пост остаётся в адресной строке. */
  const skipUrlSync = useRef(true);
  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false;
      return;
    }
    const slot = slots[activeIndex];
    if (!slot || slot.kind !== "post") return;
    const url = `/v/${slot.post.utmCode}`;
    if (window.location.pathname !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [activeIndex, slots]);

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
  }, [slots.length]);

  const goTo = useCallback((idx: number) => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-index="${idx}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleEnded = useCallback(
    (idx: number) => {
      if (idx < slots.length - 1) goTo(idx + 1);
    },
    [slots.length, goTo]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      goTo(Math.min(activeIndex + 1, slots.length - 1));
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
      {slots.map((slot, i) =>
        slot.kind === "post" ? (
          <VideoCard
            key={slot.post.utmCode}
            post={slot.post}
            index={i}
            total={slots.length}
            isActive={i === activeIndex}
            shouldLoad={Math.abs(i - activeIndex) <= 1}
            /* следующее видео грузим полностью — переход мгновенный */
            eagerPreload={i === activeIndex + 1}
            autoDonate={donateOpen === true && slot.post.utmCode === focusCode}
            onEnded={() => handleEnded(i)}
          />
        ) : (
          /* рекламная карточка prompt drop — полноэкранный snap-слот */
          <section
            key="prompt-drop-ad"
            data-index={i}
            aria-label="Prompt drop — the loki prompt"
            className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden"
          >
            <PromptDropCard variant="feed" />
          </section>
        )
      )}
    </div>
  );
}
