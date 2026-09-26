"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, EyeOff, Share2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { MOODS, getMood, type MoodKey } from "@/lib/moods";
import { withRef } from "@/lib/shareRef";
import { track } from "@/lib/bet/trackClient";
import type { ClientRankedPost } from "@/lib/posts";
import { hashRot } from "./rot";

/* ================================================================
   МОЗАИКА (v3 feed) — грид-дискавери вместо вертикальной ленты.
   - фильтры по настроениям (all / swag / creepy / future / ufo);
   - слепой суд (?blind=1): заголовки, авторы и стикеры скрыты —
     суди изображение само по себе;
   - превью: video preload=metadata, play только на hover (desktop) —
     никакого автоплея-шторма; тап → театр /v/[code] с BetPanel;
   - share: каждая карточка несёт ?ref= и мотивирует делиться.
   Ротации карточек детерминированы хэшем кода — SSR-стабильно.
   ================================================================ */

type Post = ClientRankedPost;

function MosaicCard({
  post,
  blind,
  index,
}: {
  post: Post;
  blind: boolean;
  index: number;
}) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const mood = post.mood ? getMood(post.mood) : undefined;
  const isCarousel = Boolean(post.media && post.media.length > 0);
  const previewSrc = !isCarousel ? post.videoUrl : post.media?.[0]?.url;

  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);
  const stop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {}
  }, []);

  const share = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const url = withRef(`${window.location.origin}/v/${post.utmCode}`);
      track("share_click", post.utmCode);
      try {
        if (navigator.share) {
          await navigator.share({
            title: "REAL or SYNTH?",
            text: t.feed.bettable,
            url,
          });
        } else {
          await navigator.clipboard.writeText(url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* отмена — не беда */
      }
    },
    [post.utmCode, t]
  );

  const rot = hashRot(post.utmCode);

  return (
    <article
      className="vhz-card group"
      style={{ ["--vhz-rot" as string]: rot }}
      data-code={post.utmCode}
      aria-label={blind ? t.feed.meta : post.title || post.utmCode}
    >
      <Link href={`/v/${post.utmCode}`} className="block" aria-label={t.theater.back}>
        <div className="vhz-card-video aspect-[4/5]">
          {!failed && previewSrc ? (
            <video
              ref={videoRef}
              src={previewSrc}
              muted
              loop
              playsInline
              preload="metadata"
              onMouseEnter={play}
              onMouseLeave={stop}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="vhz-mono flex h-full w-full items-center justify-center text-[0.7rem] tracking-[0.2em] text-[var(--vhz-faint)] uppercase">
              signal lost
            </div>
          )}
          <span className="vhz-timecode" aria-hidden>
            ▸ {String(index + 1).padStart(2, "0")}
          </span>
          {/* слепой суд: глаз-метка вместо метаданных */}
          {blind && (
            <span className="vhz-mono absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-[rgba(5,5,8,0.78)] px-2 py-1 text-[0.62rem] tracking-[0.16em] text-[var(--vhz-magenta)] uppercase">
              <EyeOff className="h-3 w-3" /> {t.blind.toggle}
            </span>
          )}
        </div>

        <div className="p-3.5">
          {blind ? (
            <p className="vhz-mono text-[0.7rem] leading-relaxed tracking-[0.1em] text-[var(--vhz-faint)] uppercase">
              {t.feed.blindHint}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {mood && (
                  <span
                    className="vhz-stamp px-1.5 py-0.5 text-[0.6rem]"
                    style={{ color: mood.color }}
                  >
                    {mood.glyph} {mood.en.label}
                  </span>
                )}
                {post.bettable && (
                  <span className="vhz-mono rounded bg-[rgba(255,0,60,0.14)] px-1.5 py-0.5 text-[0.6rem] font-bold tracking-[0.12em] text-[var(--vhz-blood)] uppercase">
                    $ {t.feed.bettable}
                  </span>
                )}
              </div>
              {post.title && (
                <h3 className="vhz-display mt-2 line-clamp-2 text-[0.9rem] leading-snug font-bold">
                  {post.title}
                </h3>
              )}
              {post.author && post.author !== "@unknown" && (
                <p className="vhz-mono mt-1.5 text-[0.68rem] tracking-[0.1em] text-[var(--vhz-faint)]">
                  @{post.author.replace(/^@/, "")}
                </p>
              )}
            </>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="vhz-mono text-[0.7rem] font-bold tracking-[0.14em] text-[var(--vhz-yellow)] uppercase">
              {t.feed.open} ▸
            </span>
            <button
              type="button"
              onClick={share}
              aria-label={t.feed.share}
              title={t.feed.share}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vhz-line)] text-[var(--vhz-dim)] transition-colors hover:border-[var(--vhz-yellow)] hover:text-[var(--vhz-yellow)]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </Link>
      {copied && (
        <span className="vhz-mono absolute top-2 left-2 rounded bg-[var(--vhz-yellow)] px-2 py-1 text-[0.6rem] font-bold tracking-[0.1em] text-[#0b0b10] uppercase">
          <Copy className="mr-1 inline h-3 w-3" /> ref link
        </span>
      )}
    </article>
  );
}

export default function Mosaic({
  posts,
  hideFilters = false,
}: {
  posts: Post[];
  /** на страницах канала /moods/[mood] фильтры избыточны */
  hideFilters?: boolean;
}) {
  const { t } = useLang();
  const router = useRouter();
  const sp = useSearchParams();
  const [blind, setBlind] = useState(false);
  const [mood, setMood] = useState<MoodKey | "all">("all");
  const firstRun = useRef(true);

  /* ?blind=1 — deep-link слепого суда; ?mood=key — канал из SEO-страниц.
     rAF: setState не синхронен с телом эффекта. */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (sp.get("blind") === "1") setBlind(true);
      const m = sp.get("mood");
      if (m && MOODS.some((x) => x.key === m)) {
        setMood(m as MoodKey);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [sp]);

  const toggleBlind = useCallback(() => {
    setBlind((b) => {
      const next = !b;
      const url = new URL(window.location.href);
      if (next) url.searchParams.set("blind", "1");
      else url.searchParams.delete("blind");
      router.replace(url.pathname + url.search, { scroll: false });
      return next;
    });
  }, [router]);

  /* первый осознанный выбор настроения — сигнальное событие */
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (mood !== "all") track("mood_filter", mood);
  }, [mood]);

  const filtered = useMemo(
    () => (mood === "all" ? posts : posts.filter((p) => p.mood === mood)),
    [posts, mood]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {/* панель управления судом */}
      {!hideFilters && (
      <div className="sticky top-[var(--nr-header-h)] z-40 -mx-4 mb-7 border-b border-[var(--vhz-line)] bg-[rgba(11,11,16,0.88)] px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMood("all")}
            className={`vhz-chip ${mood === "all" ? "is-active" : ""}`}
          >
            {t.feed.all} · {posts.length}
          </button>
          {MOODS.map((m) => {
            const n = posts.filter((p) => p.mood === m.key).length;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMood(m.key)}
                className={`vhz-chip ${mood === m.key ? "is-active" : ""}`}
                style={
                  mood === m.key
                    ? { background: m.color, borderColor: m.color }
                    : undefined
                }
              >
                <span aria-hidden style={{ color: mood === m.key ? undefined : m.color }}>
                  {m.glyph}
                </span>
                {m.en.label} · {n}
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleBlind}
            aria-pressed={blind}
            className={`vhz-chip ml-auto ${blind ? "is-active" : ""}`}
            style={blind ? { background: "var(--vhz-magenta)", borderColor: "var(--vhz-magenta)", color: "#0b0b10" } : undefined}
            title={t.blind.body}
          >
            <EyeOff className="h-3.5 w-3.5" /> {blind ? t.blind.on : t.blind.off}
          </button>
        </div>
      </div>
      )}

      {filtered.length === 0 ? (
        <div className="vhz-panel mx-auto max-w-sm p-8 text-center">
          <p className="vhz-display font-extrabold">{t.feed.empty}</p>
          <p className="vhz-mono mt-2 text-[0.72rem] tracking-[0.1em] text-[var(--vhz-faint)] uppercase">
            {t.feed.emptyHint}
          </p>
        </div>
      ) : (
        <div className="vhz-mosaic">
          {filtered.map((p, i) => (
            <MosaicCard key={p.utmCode} post={p} blind={blind} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
