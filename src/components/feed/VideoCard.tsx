"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Pause,
  Play,
  Repeat2,
  Share2,
  TrendingUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { FeedPost } from "@/lib/csv";

export type PostWithScore = FeedPost & { score: number };

interface VideoCardProps {
  post: PostWithScore;
  index: number;
  total: number;
  isActive: boolean;
  onEnded: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const STATUS_VISIBLE_MS = 3400;

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Выразительный прогресс-бар: изолированный rAF-цикл, скраб, время   */
/*  (перерисовывает только себя, не всю карточку)                      */
/* ------------------------------------------------------------------ */

interface ProgressBarProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSeek: (ratio: number) => void; // ставит currentTime + синхронизирует фон
  onScrubStart: () => void;
  onScrubEnd: () => void;
}

function ProgressBar({ videoRef, onSeek, onScrubStart, onScrubEnd }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    let raf = 0;
    let lastDur = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration > 0) {
        setProgress(Math.min(v.currentTime / v.duration, 1));
        setCurrentTime(v.currentTime);
        if (v.duration !== lastDur) {
          lastDur = v.duration;
          setDuration(v.duration);
        }
        try {
          if (v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1) / v.duration);
          }
        } catch {}
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  const ratioFromEvent = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    draggingRef.current = true;
    setScrubbing(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onSeek(ratioFromEvent(e.clientX));
    onScrubStart();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    onSeek(ratioFromEvent(e.clientX));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setScrubbing(false);
    onScrubEnd();
    e.stopPropagation();
  };

  return (
    <div
      className="absolute inset-x-3 bottom-3 z-20"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={barRef}
        role="slider"
        aria-label="Прогресс видео"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${fmt(currentTime)} из ${fmt(duration)}`}
        tabIndex={-1}
        className={`group relative w-full cursor-pointer touch-none select-none rounded-full transition-all duration-300 ${
          scrubbing ? "h-4" : "h-3"
        }`}
        style={{
          background: "rgba(255,255,255,0.45)",
          backdropFilter: "blur(10px)",
          boxShadow:
            "inset 0 1px 3px rgba(27,21,35,0.18), 0 2px 14px rgba(27,21,35,0.22)",
        }}
      >
        {/* буфер */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-white/55 transition-[width] duration-300"
          style={{ width: `${buffered * 100}%` }}
        />
        {/* градиентная заливка со свечением */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${progress * 100}%`,
            background: "var(--nr-grad)",
            boxShadow:
              "0 0 16px rgba(217,70,239,.75), 0 0 34px rgba(124,58,237,.45)",
          }}
        />
        {/* светящаяся головка */}
        <div
          aria-hidden
          className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-300 ${
            scrubbing
              ? "h-4.5 w-4.5 opacity-100"
              : "h-3.5 w-3.5 opacity-90 group-hover:h-4 group-hover:w-4"
          }`}
          style={{
            left: `calc(${progress * 100}% - ${scrubbing ? 9 : 7}px)`,
            boxShadow:
              "0 0 0 3px rgba(255,255,255,.55), 0 0 18px rgba(217,70,239,.9), 0 0 40px rgba(124,58,237,.55)",
          }}
        />
        {/* время при скрабе */}
        {scrubbing && (
          <div
            className="nr-glass-deep pointer-events-none absolute -top-9 -translate-x-1/2 rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-bold text-[#1b1523]"
            style={{ left: `${progress * 100}%` }}
          >
            {fmt(currentTime)} / {fmt(duration)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideoCard({
  post,
  index,
  total,
  isActive,
  onEnded,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [statusVisible, setStatusVisible] = useState(false);
  const [pulse, setPulse] = useState<"play" | "pause" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [blocked, setBlocked] = useState(false);

  /* абсолютный UTM считаем только на клиенте в обработчиках —
     чтобы SSR и клиент рендерили одинаковый HTML (без гидратационных конфликтов) */
  const absoluteUtm = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${post.utmCode}`
      : `/r/${post.utmCode}`;

  /* ---------------- статус: мягко появляется / исчезает ---------------- */

  const showStatus = useCallback((autoHide = true) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatusVisible(true);
    if (autoHide) {
      statusTimer.current = setTimeout(
        () => setStatusVisible(false),
        STATUS_VISIBLE_MS
      );
    }
  }, []);

  const hideStatusSoon = useCallback(() => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(
      () => setStatusVisible(false),
      STATUS_VISIBLE_MS
    );
  }, []);

  /* ---------------- активация карточки ---------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    // rAF: смена статуса не синхронна с телом эффекта (требование React)
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      if (isActive) {
        setBlocked(false);
        video.play().catch(() => {
          // автозапуск заблокирован — пробуем снова со звуком off
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {
            // политика браузера жёстко требует жест — ждём клик
            setBlocked(true);
            setPaused(true);
          });
        });
        showStatus(true);
      } else {
        video.pause();
        if (statusTimer.current) clearTimeout(statusTimer.current);
        setStatusVisible(false);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isActive, showStatus]);

  /* ---------------- пауза по клику ---------------- */

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setBlocked(false);
      v.play().catch(() => {});
      setPulse("play");
      showStatus(true);
    } else {
      v.pause();
      setPulse("pause");
      showStatus(false); // на паузе статус остаётся
    }
    setTimeout(() => setPulse(null), 700);
  };

  /* ---------------- события видео ---------------- */

  const onPlayStateChange = () => setPaused(videoRef.current?.paused ?? false);

  /* размытый фон живёт в такт главному видео */
  const syncBg = () => {
    const main = videoRef.current;
    const bg = bgVideoRef.current;
    if (!main || !bg) return;
    if (Math.abs(bg.currentTime - main.currentTime) > 0.25) {
      try {
        bg.currentTime = main.currentTime;
      } catch {}
    }
  };

  const onMainPlay = () => {
    onPlayStateChange();
    syncBg();
    bgVideoRef.current?.play().catch(() => {});
  };

  const onMainPause = () => {
    onPlayStateChange();
    syncBg();
    bgVideoRef.current?.pause();
  };

  const onMainSeeked = () => syncBg();

  const handleEnded = () => {
    if (index < total - 1) {
      onEnded();
    } else {
      // последнее видео — мягкий реплей
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
      showStatus(true);
    }
  };

  /* ---------------- скраб: мост к ProgressBar ---------------- */

  const seekWithBg = useCallback((ratio: number) => {
    const v = videoRef.current;
    const bg = bgVideoRef.current;
    if (v && v.duration > 0) {
      v.currentTime = ratio * v.duration;
      if (bg) bg.currentTime = v.currentTime;
    }
  }, []);

  /* ---------------- Share Reality: копия UTM ---------------- */

  const copyUtm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const utmUrl = absoluteUtm();
    let ok = false;
    try {
      await navigator.clipboard.writeText(utmUrl);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = utmUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  /* ---------------- репост в Threads ---------------- */

  const openRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = encodeURIComponent(
      `${post.title ? post.title + " — " : ""}no reality. ${absoluteUtm()}`
    );
    window.open(
      `https://www.threads.net/intent/post?text=${text}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /* ---------------- render ---------------- */

  const hasMeta = Boolean(post.author || post.title);

  return (
    <section
      data-index={index}
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-[#f6f2fb]"
    >
      {/* ---------- размытый фон-клон ---------- */}
      <video
        ref={bgVideoRef}
        src={post.videoUrl}
        muted
        playsInline
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl"
      />
      {/* ---------- основное видео ---------- */}
      <video
        ref={videoRef}
        src={post.videoUrl}
        muted={muted}
        playsInline
        loop={false}
        preload={index === 0 ? "auto" : "metadata"}
        onPlay={onMainPlay}
        onPause={onMainPause}
        onSeeked={onMainSeeked}
        onTimeUpdate={syncBg}
        onEnded={handleEnded}
        onError={() => setError(true)}
        onClick={togglePlay}
        className="relative h-full w-full cursor-pointer object-contain"
      />

      {/* мягкая виньетка для читаемости интерфейса */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44"
        style={{
          background:
            "linear-gradient(to top, rgba(27,21,35,0.42), rgba(27,21,35,0.12) 55%, transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background:
            "linear-gradient(to bottom, rgba(27,21,35,0.25), transparent)",
        }}
      />

      {/* ---------- пульс паузы/плей ---------- */}
      <AnimatePresence>
        {pulse && (
          <motion.div
            key={pulse}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 1.25] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              className="nr-glass-deep flex h-20 w-20 items-center justify-center rounded-full"
              style={{ boxShadow: "0 0 40px rgba(217,70,239,.45)" }}
            >
              {pulse === "pause" ? (
                <Pause className="h-8 w-8 text-[#7c3aed]" />
              ) : (
                <Play className="h-8 w-8 translate-x-0.5 text-[#7c3aed]" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- подсказка при блокировке автоплея ---------- */}
      {blocked && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="nr-glass-deep flex items-center gap-2.5 rounded-full px-5 py-3"
          >
            <Play className="h-4 w-4 text-[#7c3aed]" />
            <span className="text-[0.8rem] font-bold tracking-tight">
              нажми, чтобы смотреть
            </span>
          </motion.div>
        </div>
      )}

      {/* ---------- звук ---------- */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const v = videoRef.current;
          if (!v) return;
          v.muted = !v.muted;
          setMuted(v.muted);
        }}
        aria-label={muted ? "Включить звук" : "Выключить звук"}
        className="nr-glass absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full text-[#1b1523] transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,.35)]"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* ---------- ошибка загрузки ---------- */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
          <div className="nr-glass-deep max-w-xs rounded-3xl px-6 py-7 text-center">
            <p className="font-bold tracking-tight">видео временно недоступно</p>
            <p className="mt-2 text-xs leading-relaxed text-[#1b1523]/60">
              ссылка CDN могла устареть — обнови{" "}
              <code className="font-mono">video_url</code> в{" "}
              <code className="font-mono">/data/posts.csv</code>
            </p>
          </div>
        </div>
      )}

      {/* ---------- glass-статус (author / title) ---------- */}
      <AnimatePresence>
        {statusVisible && hasMeta && !error && (
          <motion.div
            initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            transition={{ duration: 0.65, ease: EASE }}
            className="absolute bottom-[4.25rem] left-3 right-3 z-20 sm:right-auto sm:max-w-md"
          >
            <div className="nr-glass-deep rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="bg-clip-text text-sm font-bold tracking-tight text-transparent [background-image:var(--nr-grad)]">
                  {post.author || "unknown"}
                </span>
                <span className="ml-auto flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[0.65rem] font-bold text-[#7c3aed]">
                  <TrendingUp className="h-3 w-3" />
                  {post.score}
                </span>
              </div>
              {post.title && (
                <p className="nr-status-shadow mt-1 line-clamp-2 text-[0.78rem] leading-snug text-[#1b1523]/85">
                  {post.title}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- кнопки действий ---------- */}
      <div className="absolute bottom-[4.25rem] right-3 z-20 flex flex-col items-end gap-2">
        {/* Share Reality — главный CTA */}
        <motion.button
          onClick={copyUtm}
          whileTap={{ scale: 0.94 }}
          animate={
            copied
              ? { scale: [1, 1.14, 1], rotate: [0, -2.5, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.55, ease: EASE }}
          aria-label="Скопировать UTM-ссылку, чтобы поднять видео в ленте"
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.75rem] font-bold text-white transition-shadow duration-500 sm:text-[0.8rem] ${
            copied ? "nr-ring-glow" : "nr-btn-glow"
          }`}
          style={{ background: "var(--nr-grad)" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                скопировано
              </motion.span>
            ) : (
              <motion.span
                key="share"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                share reality
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* открыть в Threads — через /r/[code], клик засчитывается */}
        <motion.a
          href={`/r/${post.utmCode}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Открыть это видео в Threads"
          className="nr-glass flex items-center gap-2 rounded-full px-4 py-2 text-[0.72rem] font-bold text-[#1b1523] transition-shadow duration-300 hover:shadow-[0_0_24px_rgba(124,58,237,.4)] sm:text-[0.78rem]"
        >
          <ArrowUpRight className="h-4 w-4 text-[#7c3aed]" />
          threads
        </motion.a>

        {/* репост на своей странице */}
        <motion.button
          onClick={openRepost}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Опубликовать этот пост на своей странице в Threads"
          className="nr-glass flex items-center gap-2 rounded-full px-4 py-2 text-[0.72rem] font-bold text-[#1b1523] transition-shadow duration-300 hover:shadow-[0_0_24px_rgba(236,72,153,.4)] sm:text-[0.78rem]"
        >
          <Repeat2 className="h-4 w-4 text-[#ec4899]" />
          репост
        </motion.button>
      </div>

      {/* ---------- выразительный прогресс-бар ---------- */}
      <ProgressBar
        videoRef={videoRef}
        onSeek={seekWithBg}
        onScrubStart={() => showStatus(false)}
        onScrubEnd={hideStatusSoon}
      />
    </section>
  );
}
