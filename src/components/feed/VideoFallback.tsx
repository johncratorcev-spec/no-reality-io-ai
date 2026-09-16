"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, RefreshCw } from "lucide-react";

/**
 * Премиальный анимированный fallback вместо битого/отсутствующего видео.
 *
 * Эстетика «no reality»: глубокий космос, ледяные сканлайны, парящие
 * частицы, редкий глитч-джиттер надписи SIGNAL LOST. Вся анимация — CSS
 * (transform/opacity), ни одного JS-цикла: вкладка с лентой остаётся
 * лёгкой даже с несколькими fallback'ами на экране.
 *
 * Показывается при onError у <video> или когда video_url пуст.
 * Здесь же — вся бизнес-логика карточки: Copy Prompt, Open in Threads,
 * кнопка ретрая (CDN-ссылки Threads протухают, повторный маунт иногда
 * спасает ссылку из кэша).
 */

interface VideoFallbackProps {
  author?: string;
  title?: string;
  badge?: string;
  /** промпт, доступный для копирования (извлечён или разблокирован) */
  prompt: string | null;
  /** промпт продаётся, но ещё не разблокирован */
  lockedPrompt?: boolean;
  priceUsdt?: string;
  onUnlockClick?: () => void;
  /** ретрай без перезагрузки страницы (сохраняет позицию в ленте) */
  onRetry?: () => void;
  utmCode: string;
}

/* частицы задаются один раз — детерминированно, без рандома на рендер */
const PARTICLES = [
  { left: "12%", dur: "11s", delay: "0s", drift: "26px", size: 3 },
  { left: "24%", dur: "14s", delay: "3.2s", drift: "-18px", size: 2 },
  { left: "37%", dur: "12.5s", delay: "6.1s", drift: "30px", size: 3 },
  { left: "49%", dur: "16s", delay: "1.8s", drift: "-24px", size: 2 },
  { left: "61%", dur: "13s", delay: "8.4s", drift: "18px", size: 3 },
  { left: "72%", dur: "15s", delay: "4.6s", drift: "-30px", size: 2 },
  { left: "84%", dur: "12s", delay: "9.7s", drift: "22px", size: 3 },
  { left: "93%", dur: "17s", delay: "2.5s", drift: "-14px", size: 2 },
] as const;

export default function VideoFallback({
  author,
  title,
  prompt,
  lockedPrompt = false,
  priceUsdt,
  onUnlockClick,
  onRetry,
  utmCode,
}: VideoFallbackProps) {
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(t);
  }, [copied]);

  const copyPrompt = useCallback(async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      /* clipboard недоступен (не https / права) — молча игнорируем */
    }
  }, [prompt]);

  /* ретрай: если родитель умеет ремонтировать <video> без перезагрузки —
     используем его (сохраняет позицию в ленте), иначе перезагружаем страницу */
  const retry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    if (onRetry) {
      setTimeout(() => {
        setRetrying(false);
        onRetry();
      }, 450);
    } else {
      setTimeout(() => window.location.reload(), 450);
    }
  }, [retrying, onRetry]);

  return (
    <div
      className="nr-fb absolute inset-0 z-10 select-none overflow-hidden"
      role="status"
      aria-label="Video unavailable"
    >
      {/* --- слои атмосферы --- */}
      <div className="nr-fb-orb nr-fb-orb-a" aria-hidden />
      <div className="nr-fb-orb nr-fb-orb-b" aria-hidden />
      <div className="nr-fb-scanlines" aria-hidden />
      <div className="nr-fb-sweep" aria-hidden />
      <div className="nr-fb-noise" aria-hidden />

      {/* --- парящие частицы --- */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="nr-fb-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: p.dur,
            animationDelay: p.delay,
            ["--drift" as string]: p.drift,
          }}
        />
      ))}

      {/* --- рамка-терминал --- */}
      <div className="nr-fb-frame absolute inset-3 rounded-3xl sm:inset-5" aria-hidden />

      {/* --- контент --- */}
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-5 px-8 pb-16 text-center">
        <div className="nr-fb-in flex flex-col items-center gap-3">
          <p
            className="nr-fb-glitch font-mono text-[0.68rem] font-bold uppercase sm:text-[0.75rem]"
            data-text="signal lost"
          >
            signal lost
          </p>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#5b9bd5]/60 to-transparent" />
        </div>

        {author && (
          <p className="nr-fb-in-2 text-sm font-bold tracking-tight text-[#e8f1f8]">
            {author}
          </p>
        )}
        {title && (
          <p className="nr-fb-in-2 max-w-md text-[0.82rem] leading-relaxed text-[#e8f1f8]/60 line-clamp-3">
            {title}
          </p>
        )}

        <div className="nr-fb-in-3 mt-1 flex flex-wrap items-center justify-center gap-2.5">
          {/* приоритет: разблокированный/извлечённый промпт → копия;
              платный и закрытый → кнопка Unlock; иначе только Threads */}
          {prompt ? (
            <button
              onClick={copyPrompt}
              className="nr-fb-btn nr-fb-btn-primary flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.75rem] font-bold"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  copy prompt
                </>
              )}
            </button>
          ) : lockedPrompt ? (
            <button
              onClick={onUnlockClick}
              className="nr-fb-btn nr-fb-btn-primary flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.75rem] font-bold"
            >
              unlock prompt{priceUsdt ? ` · ${priceUsdt} USDT` : ""}
            </button>
          ) : null}

          <a
            href={`/r/${utmCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="nr-fb-btn flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.75rem] font-bold"
          >
            <ArrowUpRight className="h-4 w-4" />
            open in threads
          </a>
        </div>

        <button
          onClick={retry}
          disabled={retrying}
          className="nr-fb-in-3 mt-1 flex items-center gap-1.5 text-[0.68rem] font-semibold text-[#a8cfea]/55 transition-colors hover:text-[#a8cfea] disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "reconnecting…" : "try again"}
        </button>
      </div>
    </div>
  );
}
