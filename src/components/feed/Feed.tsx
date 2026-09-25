"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoCard, { type PostWithScore } from "./VideoCard";
import { CRYO } from "@/lib/cryo/config";
import type { CryoMarketView } from "@/lib/cryo/core";
import { peekCryoWallet } from "@/lib/cryo/wallet";
import { hydrateFavorites } from "@/lib/favorites";

type Slot = { kind: "post"; post: PostWithScore };

interface FeedProps {
  posts: PostWithScore[];
  /** utm-код поста с deep-link страницы /v/[code] — к нему прыгаем при монтировании */
  focusCode?: string;
  /** deep-link ?donate=1: авто-открыть донат на сфокусированной карточке */
  donateOpen?: boolean;
  /** ⚠️ устарел (v2): рекламный слот prompt drop убран с главного пути.
   *  Принимается для совместимости ссылки ?drop=1, но игнорируется. */
  dropOpen?: boolean;
}

/**
 * Pure vertical scroll лента (snap-scroll).
 * Активная карточка определяется IntersectionObserver'ом,
 * по окончании видео — мягкий автопереход к следующей.
 *
 * v2: рекламный слот prompt drop УБРАН с главного пути (ТЗ §6 Phase 0) —
 * промпт-маркет живёт только как апселл после проигрыша (BetPanel).
 *
 * Deep-link (/v/[code]): начальный активный индекс берётся из focusCode,
 * а адресная строка всегда синхронизируется с активным видео
 * (history.replaceState — без записей в истории, Next это поддерживает).
 */
export default function Feed({ posts, focusCode, donateOpen }: FeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---- Cryo-Stop: рынки предсказаний (task 41) ----
     Один поллер на всю ленту (task 43: setTimeout-цепочка вместо
     setInterval — запросы не накладываются; на скрытой вкладке не тикаем;
     setState только при реальном изменении данных — memo-карточки не
     перерисовываются впустую). БД недоступна → 200 с db:false. */
  const [cryoViews, setCryoViews] = useState<Map<string, CryoMarketView>>(
    () => new Map()
  );

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastJson = "";

    const schedule = () => {
      if (!stopped) timer = setTimeout(() => void load(), CRYO.pollMs);
    };

    const load = async () => {
      if (document.visibilityState === "hidden") {
        schedule(); // вкладка в фоне — спим дальше без запроса
        return;
      }
      try {
        const wallet = await peekCryoWallet();
        const qs = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
        const r = await fetch(`/api/cryo/markets${qs}`, { cache: "no-store" });
        if (r.ok) {
          const d = (await r.json()) as { markets?: CryoMarketView[] };
          const json = JSON.stringify(d.markets ?? []);
          if (!stopped && d.markets && json !== lastJson) {
            lastJson = json;
            setCryoViews(new Map(d.markets.map((m) => [m.postCode, m])));
          }
        }
      } catch {
        /* рынок не критичен для ленты */
      }
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void load();
      }
    };

    void load();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* избранное (task 43): одна гидратация на всю ленту */
  useEffect(() => {
    void hydrateFavorites();
  }, []);

  /* ---- счётчики «N members saved» (task 44, ТЗ §3) ----
     Лёгкий поллер (60с, setTimeout-цепочка, на скрытой вкладке спит):
     один запрос на всю ленту; после тоггла сердца счётчик двигается
     оптимистично через событие nr-fav-toggled (без запроса). */
  const [favCounts, setFavCounts] = useState<Record<string, number>>({});
  const postCodes = useMemo(() => posts.map((p) => p.utmCode), [posts]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastJson = "";

    const schedule = () => {
      if (!stopped) timer = setTimeout(() => void load(), 60_000);
    };

    const load = async () => {
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      try {
        const qs = encodeURIComponent(postCodes.join(","));
        const r = await fetch(`/api/favorites/counts?codes=${qs}`, {
          cache: "no-store",
        });
        if (r.ok && !stopped) {
          const d = (await r.json()) as {
            counts?: Record<string, number>;
          };
          const json = JSON.stringify(d.counts ?? {});
          if (json !== lastJson) {
            lastJson = json;
            setFavCounts(d.counts ?? {});
          }
        }
      } catch {
        /* счётчик не критичен */
      }
      schedule();
    };

    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ postCode: string; on: boolean }>).detail;
      if (!detail) return;
      setFavCounts((m) => ({
        ...m,
        [detail.postCode]: Math.max(
          0,
          (m[detail.postCode] ?? 0) + (detail.on ? 1 : -1)
        ),
      }));
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void load();
      }
    };

    void load();
    schedule();
    window.addEventListener("nr-fav-toggled", onToggle);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("nr-fav-toggled", onToggle);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [postCodes]);

  const slots = useMemo<Slot[]>(
    () => posts.map((post) => ({ kind: "post", post })),
    [posts]
  );

  const findPostSlot = useCallback(
    (code: string) =>
      slots.findIndex(
        (s) => s.kind === "post" && s.post.utmCode === code
      ),
    [slots]
  );

  const [activeIndex, setActiveIndex] = useState(() => {
    if (!focusCode) return 0;
    const i = findPostSlot(focusCode);
    return i >= 0 ? i : 0;
  });

  /* мгновенный прыжок к запрошенному видео после монтирования
     (behavior по умолчанию — auto, без плавной прокрутки через всю ленту;
      активный индекс уже установлен выше — нужное видео монтируется сразу) */
  useEffect(() => {
    if (!focusCode) return;
    const idx = findPostSlot(focusCode);
    if (idx <= 0) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${idx}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [focusCode, findPostSlot]);

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
      {slots.map((slot, i) => (
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
            landHard={focusCode === slot.post.utmCode}
            market={cryoViews.get(slot.post.utmCode) ?? null}
            favCount={favCounts[slot.post.utmCode] ?? 0}
            onEnded={handleEnded}
          />
      ))}
    </div>
  );
}
