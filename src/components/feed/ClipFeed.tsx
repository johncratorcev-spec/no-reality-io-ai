"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flame, Trophy, Users } from "lucide-react";
import ClipCard, { type ClipMode } from "./ClipCard";
import OnboardingOverlay from "@/components/bet/OnboardingOverlay";
import LeaderboardPanel from "@/components/bet/LeaderboardPanel";
import { useLang } from "@/lib/i18n";
import type { ClientRankedPost } from "@/lib/posts";
import { track } from "@/lib/bet/trackClient";

interface ClipFeedProps {
  posts: ClientRankedPost[];
  mode: ClipMode;
  /** deep-link /v/[code]: к этому посту прыгаем при монтировании и синхронизируем адрес */
  focusCode?: string;
}

type MoodFilter = "all" | "swag" | "future" | "creepy" | "ufo";

const MOODS: Array<{ key: MoodFilter; label: string; color: string }> = [
  { key: "all", label: "ALL", color: "#F2EDE4" },
  { key: "swag", label: "SWAG", color: "#FFD400" },
  { key: "future", label: "FUTURE", color: "#00E5FF" },
  { key: "creepy", label: "CREEPY", color: "#FF2BA6" },
  { key: "ufo", label: "UFO", color: "#7CFF4D" },
];

/**
 * ClipFeed — бесконечная вертикальная лента (snap-scroll), v5.
 * Легаси-поллеры (cryo/favorites) вырезаны: фид чистый и лёгкий.
 * Активная карточка — IntersectionObserver; по окончании видео —
 * мягкий автопереход к следующей; стрелки ↑/↓ листают.
 *
 * v5 (только предикшен-лента): moods-свитчер, Daily Hard Mode,
 * live-индикатор «сейчас ставят», Best Eyes Leaderboard, онбординг.
 * Обычная лента (watch) осталась нетронутой.
 */
export default function ClipFeed({ posts, mode, focusCode }: ClipFeedProps) {
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const isBet = mode === "bet";

  /* ---- v5 контролы предикшен-ленты ---- */
  const [mood, setMood] = useState<MoodFilter>("all");
  const [hardCodes, setHardCodes] = useState<string[] | null>(null);
  const [hardOn, setHardOn] = useState(false);
  const [hardLoading, setHardLoading] = useState(false);
  const [liveBettors, setLiveBettors] = useState<number | null>(null);
  const [lbOpen, setLbOpen] = useState(false);

  const toggleHard = useCallback(() => {
    if (hardOn) {
      setHardOn(false);
      return;
    }
    if (hardCodes) {
      setHardOn(true);
      return;
    }
    setHardLoading(true);
    track("hard_mode_open");
    fetch("/api/bet/hard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { codes: [] }))
      .then((d: { codes?: string[] }) => {
        setHardCodes(d.codes ?? []);
        setHardOn(true);
      })
      .catch(() => setHardCodes([]))
      .finally(() => setHardLoading(false));
  }, [hardOn, hardCodes]);

  /* live-индикатор: пока предикшен-лента открыта, тик каждые 15с */
  useEffect(() => {
    if (!isBet) return;
    let stopped = false;
    const load = () =>
      fetch("/api/bet/live", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { betting?: number } | null) => {
          if (!stopped && d) setLiveBettors(d.betting ?? 0);
        })
        .catch(() => {});
    void load();
    const t = setInterval(load, 15_000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [isBet]);

  const filteredPosts = useMemo(() => {
    if (!isBet) return posts;
    let out = posts;
    if (hardOn && hardCodes) {
      const set = new Set(hardCodes);
      out = out.filter((p) => set.has(p.utmCode));
    }
    return out;
  }, [posts, isBet, mood, hardOn, hardCodes]);

  const findIndex = useCallback(
    (code: string) => filteredPosts.findIndex((p) => p.utmCode === code),
    [filteredPosts]
  );

  const [activeIndex, setActiveIndex] = useState(() => {
    if (!focusCode) return 0;
    const i = findIndex(focusCode);
    return i >= 0 ? i : 0;
  });

  /* фильтр сменился — активным становится верхний клип
     (первый рендер пропускаем: иначе deep-link-прыжок ломается).
     setState отложен в rAF — без cascading render. */
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    const raf = requestAnimationFrame(() => {
      setActiveIndex(0);
      containerRef.current?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [mood, hardOn]);

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
    const post = filteredPosts[activeIndex];
    if (!post) return;
    const url = `/v/${post.utmCode}`;
    if (window.location.pathname !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [activeIndex, filteredPosts, focusCode]);

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
  }, [filteredPosts.length]);

  const goTo = useCallback((idx: number) => {
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${idx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleEnded = useCallback(
    (idx: number) => {
      if (idx < filteredPosts.length - 1) goTo(idx + 1);
    },
    [filteredPosts.length, goTo]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      goTo(Math.min(activeIndex + 1, filteredPosts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      goTo(Math.max(activeIndex - 1, 0));
    }
  };

  if (posts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-sm rounded-3xl border border-white/10 bg-[rgba(16,13,22,0.8)] px-8 py-10 text-center backdrop-blur-md">
          <p className="text-lg font-extrabold tracking-tight text-white">the feed is empty</p>
          <p className="mt-2 text-sm font-semibold text-white/55">
            BD-панель добавляет клипы в очередь <code className="font-mono text-white/75">/admin/bd</code> — they
            will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ---------- v5: контролы предикшен-ленты ---------- */}
      {isBet && (
        <div className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex items-center gap-1.5 overflow-x-auto bg-gradient-to-b from-[rgba(6,5,10,0.85)] to-transparent px-3 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MOODS.map((m) => {
            const active = mood === m.key && !hardOn;
            return (
              <button
                key={m.key}
                onClick={() => {
                  setMood(m.key);
                  setHardOn(false);
                }}
                className="shrink-0 rounded-full border px-2.5 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.12em] backdrop-blur-md transition-transform duration-200 hover:scale-[1.05] active:scale-95 sm:px-3 sm:tracking-[0.16em]"
                style={{
                  borderColor: active ? m.color : "rgba(242,237,228,.14)",
                  color: active ? m.color : "rgba(242,237,228,.6)",
                  background: active ? "rgba(16,13,22,0.85)" : "rgba(16,13,22,0.6)",
                }}
                aria-pressed={active}
              >
                {m.label}
              </button>
            );
          })}

          <button
            onClick={toggleHard}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.12em] backdrop-blur-md transition-transform duration-200 hover:scale-[1.05] active:scale-95 sm:px-3 sm:tracking-[0.16em]"
            style={{
              borderColor: hardOn ? "var(--nb-blood)" : "rgba(242,237,228,.14)",
              color: hardOn ? "var(--nb-blood)" : "rgba(242,237,228,.6)",
              background: "rgba(16,13,22,0.6)",
            }}
            aria-pressed={hardOn}
            title="самые сложные клипы дня"
          >
            <Flame className="h-3 w-3" aria-hidden />
            {hardLoading ? "…" : hardOn ? "HARD MODE" : "HARD"}
          </button>

          <div className="ml-1.5 flex shrink-0 items-center gap-1.5 sm:ml-auto">
            {/* live-индикатор: «сейчас ставят» */}
            {liveBettors != null && liveBettors > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[0.6rem] font-black tracking-[0.08em] backdrop-blur-md"
                style={{
                  borderColor: "rgba(200,255,0,.35)",
                  color: "var(--nb-poison)",
                  background: "rgba(16,13,22,0.6)",
                }}
                title="ставят прямо сейчас"
              >
                <Users className="h-3 w-3" aria-hidden />
                {liveBettors}
              </span>
            )}

            <button
              onClick={() => setLbOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.16em] backdrop-blur-md transition-transform duration-200 hover:scale-[1.05] active:scale-95"
              style={{
                borderColor: "rgba(242,237,228,.14)",
                color: "rgba(242,237,228,.7)",
                background: "rgba(16,13,22,0.6)",
              }}
              aria-label="best eyes leaderboard"
            >
              <Trophy className="h-3 w-3" aria-hidden />
              eyes
            </button>
          </div>
        </div>
      )}

      {/* hard mode: пусто → честный пустой стейт */}
      {isBet && hardOn && hardCodes && filteredPosts.length === 0 ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="max-w-sm rounded-3xl border border-white/10 bg-[rgba(16,13,22,0.8)] px-8 py-10 text-center backdrop-blur-md">
            <p className="text-lg font-extrabold tracking-tight text-white">hard mode остыл</p>
            <p className="mt-2 text-sm font-semibold text-white/55">
              за последние 48 часов толпа ещё не ошибалась достаточно — заходи позже
            </p>
          </div>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="max-w-sm rounded-3xl border border-white/10 bg-[rgba(16,13,22,0.8)] px-8 py-10 text-center backdrop-blur-md">
            <p className="text-lg font-extrabold tracking-tight text-white">
              {isBet && mood !== "all"
                ? t.feed.moodEmpty.replace("{m}", mood)
                : t.feed.empty}
            </p>
            <p className="mt-2 text-sm font-semibold text-white/55">
              {isBet && mood !== "all"
                ? t.feed.moodEmptyHint
                : t.feed.emptyHint}
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="region"
          aria-label={isBet ? "Raffle feed" : "Video feed"}
          className={`nr-feed h-full w-full snap-y snap-mandatory overflow-y-auto outline-none ${
            isBet ? "pt-11 nr-feed-bet" : ""
          }`}
        >
          {filteredPosts.map((post, i) => (
            <ClipCard
              key={post.utmCode}
              post={post}
              index={i}
              total={filteredPosts.length}
              isActive={i === activeIndex}
              shouldLoad={Math.abs(i - activeIndex) <= 1}
              /* следующее видео грузим полностью — переход мгновенный */
              eagerPreload={i === activeIndex + 1}
              mode={mode}
              onEnded={handleEnded}
              onNext={i < filteredPosts.length - 1 ? () => goTo(i + 1) : undefined}
            />
          ))}
        </div>
      )}

      {/* ---------- v5: онбординг + leaderboard ---------- */}
      {isBet && <OnboardingOverlay />}
      {isBet && lbOpen && <LeaderboardPanel onClose={() => setLbOpen(false)} />}
    </div>
  );
}
