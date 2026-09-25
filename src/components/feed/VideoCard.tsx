"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowUpRight,
  AtSign,
  Check,
  Copy,
  Eye,
  Heart,
  Lock,
  Paperclip,
  Pause,
  Play,
  Share2,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  Wrench,
} from "lucide-react";
import type { ClientPost } from "@/lib/csv";
import { isBoosted } from "@/lib/boost";
import { pseudoViews } from "@/lib/utils";
import { playMeow } from "@/lib/meow";
import { PARTNER_OF_WEEK } from "@/lib/site";
import { toggleFavorite, useFavoritesStore } from "@/lib/favorites";
import MediaCarousel from "./MediaCarousel";
import DonateBox from "./DonateBox";
import BetPanel from "@/components/bet/BetPanel";
import { extractPrompt } from "@/lib/prompts/extract";
import VideoFallback from "./VideoFallback";
import UnlockModal from "./UnlockModal";
import CryoStopCard from "./CryoStopCard";
import type { CryoMarketView, CryoSide } from "@/lib/cryo/core";
import { readCryoLocalBet } from "@/lib/cryo/local";
import { withRef } from "@/lib/shareRef";

export type PostWithScore = ClientPost & { score: number };

/** подпись исхода по ключу опции: нарративная опция → классика yes/no → сырой ключ */
function cryoOptionLabel(m: CryoMarketView, key: string): string {
  const o = m.options?.find((x) => x.key === key);
  if (o) return o.label;
  if (key === "yes") return m.labelYes;
  if (key === "no") return m.labelNo;
  return key;
}

interface VideoCardProps {
  post: PostWithScore;
  index: number;
  total: number;
  isActive: boolean;
  /** карточка в зоне active±1 — только у таких монтируются <video> */
  shouldLoad: boolean;
  /** следующая за активной — preload="auto" для мгновенного перехода */
  eagerPreload?: boolean;
  /** deep-link ?donate=1 — авто-открыть донат на этой карточке */
  autoDonate?: boolean;
  /** рынок предсказаний Cryo-Stop (task 41): скрыть chrome, заморозить, дать ставить */
  market?: CryoMarketView | null;
  /** сколько авторизованных пользователей сохранили в избранное (task 44, §3) */
  favCount?: number;
  /** deep-link вход на ЭТУ карточку (/v/CODE) — land-hard у панели ставки */
  landHard?: boolean;
  /** stable callback — receives the slot index (memo-friendly, task 43) */
  onEnded: (index: number) => void;
}

const STATUS_VISIBLE_MS = 3400;

/* clipboard API + execCommand-fallback (нужен и Share Reality, и link) */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Прогресс-бар: rAF-цикл только пока карточка активна, скраб, время  */
/* ------------------------------------------------------------------ */

interface ProgressBarProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  onSeek: (ratio: number) => void; // ставит currentTime + синхронизирует фон
  onScrubStart: () => void;
  onScrubEnd: () => void;
}

function ProgressBar({ videoRef, active, onSeek, onScrubStart, onScrubEnd }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bufRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const scrubbingRef = useRef(false);

  const [scrubbing, setScrubbing] = useState(false);
  const [duration, setDuration] = useState(0);

  /* rAF-цикл активной карточки: мутируем DOM напрямую —
     ни одного setState на кадр (React не рендерится во время видео) */
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let lastDur = -1;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration > 0) {
        const p = Math.min(v.currentTime / v.duration, 1);
        const pct = (p * 100).toFixed(2);
        if (fillRef.current) fillRef.current.style.width = `${pct}%`;
        if (headRef.current) {
          headRef.current.style.left = `calc(${pct}% - ${scrubbingRef.current ? 9 : 7}px)`;
        }
        if (bufRef.current) {
          try {
            const b = v.buffered.length > 0
              ? v.buffered.end(v.buffered.length - 1) / v.duration
              : 0;
            bufRef.current.style.width = `${(b * 100).toFixed(1)}%`;
          } catch {}
        }
        if (tipRef.current) {
          tipRef.current.textContent = `${fmt(v.currentTime)} / ${fmt(v.duration)}`;
          tipRef.current.style.left = `${pct}%`;
        }
        barRef.current?.setAttribute("aria-valuenow", String(Math.round(p * 100)));
        barRef.current?.setAttribute(
          "aria-valuetext",
          `${fmt(v.currentTime)} of ${fmt(v.duration)}`
        );
        if (v.duration !== lastDur) {
          lastDur = v.duration;
          setDuration(v.duration); // один раз на метаданные
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, videoRef]);

  const ratioFromEvent = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    draggingRef.current = true;
    scrubbingRef.current = true;
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
    scrubbingRef.current = false;
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
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-valuetext="0:00"
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
          ref={bufRef}
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-white/55 transition-[width] duration-300"
          style={{ width: "0%" }}
        />
        {/* заливка со свечением */}
        <div
          ref={fillRef}
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: "0%",
            background: "#0f141a",
            boxShadow:
              "0 0 14px rgba(16,22,29,.55), 0 0 30px rgba(61,125,184,.35)",
          }}
        />
        {/* светящаяся головка */}
        <div
          ref={headRef}
          aria-hidden
          className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-300 ${
            scrubbing
              ? "h-4.5 w-4.5 opacity-100"
              : "h-3.5 w-3.5 opacity-90 group-hover:h-4 group-hover:w-4"
          }`}
          style={{
            left: "calc(0% - 7px)",
            boxShadow:
              "0 0 0 3px rgba(255,255,255,.6), 0 0 16px rgba(16,22,29,.55), 0 0 34px rgba(91,155,213,.45)",
          }}
        />
        {/* время при скрабе (текст/позиция — через ref, без ре-рендеров) */}
        {scrubbing && (
          <div
            ref={tipRef}
            className="nr-glass-deep pointer-events-none absolute -top-9 -translate-x-1/2 rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-bold text-[#0a0a0a]"
            style={{ left: "0%" }}
          >
            {fmt(0)} / {fmt(duration)}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoCardInner({
  post,
  index,
  total,
  isActive,
  shouldLoad,
  eagerPreload = false,
  autoDonate = false,
  market = null,
  favCount = 0,
  landHard = false,
  onEnded,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAction = useRef(0);
  const lastSnap = useRef(0);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [muted, setMuted] = useState(true);
  const [statusVisible, setStatusVisible] = useState(false);

  /* ---- v2: crush / glitch-eye на весь кадр (§3.1) ----
      BetPanel диспатчит nb-crush (проигрыш) и nb-glitch (резолв REAL);
      здесь слушаем только СВОЙ clip и кратко вешаем класс на корень. */
  const [frameFx, setFrameFx] = useState<"" | "nb-crush" | "nb-glitch">("");
  useEffect(() => {
    const onFx = (e: Event) => {
      const clip = (e as CustomEvent<{ clip?: string }>).detail?.clip;
      if (clip !== post.utmCode) return;
      const kind = e.type === "nb-crush" ? "nb-crush" : "nb-glitch";
      setFrameFx(kind);
      const t = setTimeout(() => setFrameFx(""), 300);
      fxTimer.current = t;
    };
    window.addEventListener("nb-crush", onFx);
    window.addEventListener("nb-glitch", onFx);
    return () => {
      window.removeEventListener("nb-crush", onFx);
      window.removeEventListener("nb-glitch", onFx);
      if (fxTimer.current) clearTimeout(fxTimer.current);
    };
  }, [post.utmCode]);
  const [pulse, setPulse] = useState<"play" | "pause" | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [error, setError] = useState(false);
  const [blocked, setBlocked] = useState(false);

  /* карусельный пост: слайды вместо одиночного видео */
  const isCarousel = Boolean(post.media && post.media.length > 0);
  /* Cryo-Stop (task 42): пока исход не выбран и рынок жив — карточка
     замораживается (после 5с просмотра) и НЕ показывает ни одной ссылки
     на видео. После выбора исхода карточка получает лейбл PREDICTED и
     показывается как обычное видео (chrome возвращается). */
  const [predicted, setPredicted] = useState<CryoSide | null>(null);
  const [marketReleased, setMarketReleased] = useState(false);
  const frozenRef = useRef(false);
  const overlayUp = Boolean(market) && !predicted && !marketReleased;

  /* локальная ставка из прошлого визита → карточка сразу PREDICTED */
  useEffect(() => {
    const lb = readCryoLocalBet(post.utmCode);
    if (lb) setPredicted(lb.side);
  }, [post.utmCode]);

  /* серверная позиция (поллинг Feed) подтверждает/уточняет исход */
  useEffect(() => {
    if (market?.myBet) setPredicted(market.myBet);
  }, [market?.myBet]);

  /* рынок истёк/решён без ставки → карточка просто живёт с плашкой */
  useEffect(() => {
    if (market && market.status !== "live") setMarketReleased(true);
  }, [market?.status]);

  /* заморозка/разморозка: в заморозке авто-плей запрещён (видео не играет),
     после таяния — ролик доигрывает целиком (пункт 4 ТЗ) */
  const handleFrozen = useCallback(
    (f: boolean) => {
      frozenRef.current = f;
      if (!f && isActive) {
        const v = videoRef.current;
        if (v) v.play().catch(() => {});
      }
    },
    [isActive, videoRef]
  );
  /* --- платный промпт: статус разблокировки + полный текст --- */
  const [unlocked, setUnlocked] = useState(false);
  const [statusReady, setStatusReady] = useState(false);
  const [fullPrompt, setFullPrompt] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [unlockFlash, setUnlockFlash] = useState(false);
  /* nonce <video>: ретрай без перезагрузки страницы (CDN-ссылка получает
     второй шанс, позиция в ленте сохраняется) */
  const [videoNonce, setVideoNonce] = useState(0);

  /* флуд-контроль кнопок: не чаще раза в cooldown мс */
  const guarded = (cooldownMs: number) => {
    const now = Date.now();
    if (now - lastAction.current < cooldownMs) return false;
    lastAction.current = now;
    return true;
  };

  /* абсолютный UTM считаем только на клиенте в обработчиках —
     чтобы SSR и клиент рендерили одинаковый HTML (без гидратационных конфликтов);
     task 44: ссылка несёт персональный ?ref= — переходы засчитываются владельцу */
  const absoluteUtm = () =>
    typeof window !== "undefined"
      ? withRef(`${window.location.origin}/r/${post.utmCode}`)
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
        if (frozenRef.current) {
          // заморозка рынка: авто-плей запрещён — видео не играет
          return;
        }
        setBlocked(false);
        video.play().catch(() => {
          // автозапуск заблокирован — пробуем снова со звуком off
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {
            // политика браузера жёстко требует жест — ждём клик
            setBlocked(true);
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

  /* видео может упасть ДО гидрации (CDN отдаёт 404 быстро) — onError
     повесятся уже после события. Ловим такие случаи свойством .error */
  useEffect(() => {
    const v = videoRef.current;
    if (v && v.error) setError(true);
  }, [videoNonce, shouldLoad]);

  /* ---------------- платный промпт: статус и разблокировка ---------------- */

  const isPaidPost = Boolean(post.isPaid);

  /* Тянем статус разблокировки только у платных карточек (лента не должна
     стрелять 47 запросов на каждый монтированный пост) и только когда
     карточка видима: return с оплаты / первый показ — оба покрываются. */
  const refreshUnlock = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch(
        `/api/prompts/${encodeURIComponent(post.utmCode)}/status`,
        { cache: "no-store" }
      );
      if (!r.ok) return false;
      const data = (await r.json()) as {
        unlocked?: boolean;
        prompt?: string | null;
        priceUsdt?: string | null;
      };
      setUnlocked(Boolean(data.unlocked));
      if (data.unlocked && data.prompt) {
        setFullPrompt(data.prompt);
        return true; // переход из закрытого состояния
      }
    } catch {
      /* сеть/БД недоступны — остаёмся в текущем состоянии */
    } finally {
      setStatusReady(true);
    }
    return false;
  }, [post.utmCode]);

  const firstStatus = useRef(true);
  useEffect(() => {
    if (!isPaidPost) return;
    if (!firstStatus.current) return;
    firstStatus.current = false;
    void refreshUnlock();
  }, [isPaidPost, refreshUnlock, isActive]);

  /* переход locked → unlocked: праздничная вспышка на карточке */
  const prevUnlocked = useRef(false);
  useEffect(() => {
    if (unlocked && !prevUnlocked.current) {
      setUnlockFlash(true);
      const t = setTimeout(() => setUnlockFlash(false), 1700);
      prevUnlocked.current = true;
      return () => clearTimeout(t);
    }
    prevUnlocked.current = unlocked;
  }, [unlocked]);

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

  /* размытый фон — canvas-снимок кадра вместо второго видеодекодера:
     drawImage в canvas 64×64 раз в ~1.2с, под CSS blur это неотличимо */
  const snapBg = (force = false) => {
    const v = videoRef.current;
    const c = bgCanvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    const now = performance.now();
    if (!force && now - lastSnap.current < 1200) return;
    lastSnap.current = now;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(v, 0, 0, c.width, c.height);
    } catch {}
  };

  const onMainPlay = () => snapBg(true);
  const onMainSeeked = () => snapBg(true);

  const handleEnded = () => {
    /* рынок живёт на карточке: пока исход не выбран — тихо лупим ролик
       (заморозка придёт после 5с просмотра); после ставки карточка
       ведёт себя как обычное видео */
    if (market && !predicted && !marketReleased) {
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
      return;
    }
    if (index < total - 1) {
      onEnded(index);
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

  const seekWithBg = useCallback((ratio: number) => {
    const v = videoRef.current;
    if (v && v.duration > 0) {
      v.currentTime = ratio * v.duration;
    }
  }, []);

  /* ---------------- Share Reality: копия UTM ---------------- */

  const copyUtm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!guarded(1200)) return; // флуд-контроль
    const ok = await writeClipboard(absoluteUtm());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  /* ---------------- link: deep-link на это видео внутри ленты ---------------- */

  const copyInternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!guarded(1200)) return; // флуд-контроль
    const linkUrl =
      typeof window !== "undefined"
        ? withRef(`${window.location.origin}/v/${post.utmCode}`)
        : `/v/${post.utmCode}`;
    const ok = await writeClipboard(linkUrl);
    if (ok) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2400);
    }
  };

  /* ---------------- репост в Threads (убран) → панель промпта ---------------- */

  const togglePrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!guarded(600)) return;
    /* платный и закрытый — гаечный ключ открывает модалку оплаты,
       а не панель; разблокированный/бесплатный — панель с текстом.
       Статус ещё не доехал (медленная сеть/холодный роут)? Догружаем
       на клике: купивший пользователь увидит свой промпт, а не заглушку. */
    if (lockedPrompt) {
      setPromptOpen(false);
      setModalOpen(true);
      return;
    }
    if (isPaidPost && !statusReady) {
      const nowUnlocked = await refreshUnlock();
      if (!nowUnlocked) {
        setModalOpen(true);
        return;
      }
    }
    setPromptOpen((open) => {
      const next = !open;
      if (next) {
        setTimeout(() => setPromptOpen(false), 9000); // авто-скрытие
      }
      return next;
    });
  };

  const copyPromptText = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = effectivePrompt;
    if (!text || !guarded(1200)) return;
    const ok = await writeClipboard(text);
    if (ok) {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2400);
    }
  };

  /* ---------------- favorites (task 43): heart after wallet auth ---------------- */

  const favs = useFavoritesStore();
  const favOn = favs.codes.has(post.utmCode);
  const [favBurst, setFavBurst] = useState(0);

  const onHeart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await toggleFavorite(post.utmCode, {
      title: post.title ?? "",
      author: post.author ?? "",
      hasVideo: Boolean(post.videoUrl) || (post.media?.length ?? 0) > 0,
    });
    if (res === "auth") {
      // не авторизован — просим кошелёк (WalletButton слушает событие)
      window.dispatchEvent(new CustomEvent("nr-wallet-connect"));
      return;
    }
    if (res === "on") setFavBurst((b) => b + 1); // виральный взрыв сердец
  };

  /* ---------------- render ---------------- */

  const hasMeta = Boolean(post.author || post.title);
  const statusShown = statusVisible && hasMeta && !error && !overlayUp;
  const boosted = isBoosted(post);
  const viewsLabel = pseudoViews(post.utmCode).toLocaleString("en-US");
  const authorHandle =
    post.author && post.author !== "@unknown"
      ? post.author.replace(/^@/, "")
      : "";

  /* --- промпт: бесплатный извлекаем из текста, платный приходит с API --- */
  const freePrompt = extractPrompt(post.title);
  const effectivePrompt = unlocked
    ? fullPrompt || freePrompt
    : isPaidPost
      ? null
      : freePrompt;
  const lockedPrompt = isPaidPost && !unlocked;

  /* fallback: битая CDN-ссылка или отсутствующий video_url */
  const showFallback = error || !post.videoUrl;


  const retryVideo = useCallback(() => {
    setError(false);
    setBlocked(false);
    setVideoNonce((n) => n + 1);
  }, []);

  /* режим панели промпта: разблокированный / бесплатный с текстом / заглушка */
  const panelMode: "unlocked" | "free" | "soon" = unlocked
    ? "unlocked"
    : freePrompt
      ? "free"
      : "soon";

  /* конфетти-осколки: детерминированные векторы, цвет — палитра ленты */
  const CONFETTI = [
    { dx: "-120px", dy: "-90px", rot: "-160deg", c: "#a8cfea", d: "0s" },
    { dx: "110px", dy: "-70px", rot: "140deg", c: "#e8f1f8", d: ".04s" },
    { dx: "-70px", dy: "-130px", rot: "-60deg", c: "#5b9bd5", d: ".08s" },
    { dx: "80px", dy: "-125px", rot: "90deg", c: "#a8cfea", d: ".02s" },
    { dx: "-140px", dy: "-20px", rot: "-110deg", c: "#e8f1f8", d: ".1s" },
    { dx: "140px", dy: "-15px", rot: "70deg", c: "#c3ddf0", d: ".06s" },
    { dx: "-40px", dy: "-150px", rot: "30deg", c: "#5b9bd5", d: ".12s" },
    { dx: "46px", dy: "-148px", rot: "-30deg", c: "#a8cfea", d: ".03s" },
    { dx: "-100px", dy: "100px", rot: "120deg", c: "#e8f1f8", d: ".09s" },
    { dx: "100px", dy: "95px", rot: "-140deg", c: "#5b9bd5", d: ".05s" },
    { dx: "0px", dy: "130px", rot: "180deg", c: "#a8cfea", d: ".11s" },
    { dx: "130px", dy: "55px", rot: "-90deg", c: "#c3ddf0", d: ".07s" },
    { dx: "-130px", dy: "60px", rot: "50deg", c: "#e8f1f8", d: ".13s" },
    { dx: "18px", dy: "-160px", rot: "10deg", c: "#5b9bd5", d: ".01s" },
  ] as const;

  return (
    <section
      data-index={index}
      className={`relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-[#0A0A0F] ${frameFx}`}
    >
      {/* ---------- размытый фон: canvas-снимок кадра (только у активной) ---------- */}
      {isActive && !isCarousel && (
        <canvas
          ref={bgCanvasRef}
          width={64}
          height={64}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl"
        />
      )}
      {/* ---------- карусель: слайды stories-стилем (только в зоне active±1) ---------- */}
      {shouldLoad && isCarousel && (
        <MediaCarousel
          slides={post.media!}
          active={isActive}
          loop={index === total - 1}
          onEnded={() => onEnded(index)}
        />
      )}
      {/* ---------- основное видео: монтируется только в зоне active±1 ----------
          nonce позволяет перемонтировать <video> после ретрая; битая ссылка
          у видео-постов заменяется fallback-сценой (у каруселей фолбэка нет) */}
      {shouldLoad && !isCarousel && !showFallback && (
        <video
          key={videoNonce}
          ref={videoRef}
          src={post.videoUrl}
          muted={muted}
          playsInline
          loop={false}
          preload={isActive || eagerPreload ? "auto" : "metadata"}
          onPlay={onMainPlay}
          onPause={() => snapBg(true)}
          onSeeked={onMainSeeked}
          onTimeUpdate={() => snapBg(false)}
          onLoadedData={() => snapBg(true)}
          onEnded={handleEnded}
          onError={() => setError(true)}
          onClick={togglePlay}
          className="relative h-full w-full cursor-pointer object-contain"
        />
      )}

      {/* ---------- премиальный fallback: SIGNAL LOST (только у видео-постов) ---------- */}
      {!isCarousel && showFallback && (
        <VideoFallback
          author={post.author}
          title={post.title}
          prompt={effectivePrompt}
          lockedPrompt={lockedPrompt}
          priceUsdt={post.priceUsdt}
          onUnlockClick={() => setModalOpen(true)}
          onRetry={retryVideo}
          utmCode={post.utmCode}
        />
      )}

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

      {/* ---------- пульс паузы/плей (CSS-анимация) ---------- */}
      {pulse && (
        <div
          key={pulse}
          className="nr-anim-pulse pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        >
          <div
            className="nr-glass-deep flex h-20 w-20 items-center justify-center rounded-full"
            style={{ boxShadow: "0 0 40px rgba(16,22,29,.35)" }}
          >
            {pulse === "pause" ? (
              <Pause className="h-8 w-8 text-[#0a0a0a]" />
            ) : (
              <Play className="h-8 w-8 translate-x-0.5 text-[#0a0a0a]" />
            )}
          </div>
        </div>
      )}

      {/* ---------- подсказка при блокировке автоплея ---------- */}
      {blocked && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="nr-anim-hint nr-glass-deep flex items-center gap-2.5 rounded-full px-5 py-3">
            <Play className="h-4 w-4 text-[#0a0a0a]" />
            <span className="text-[0.8rem] font-bold tracking-tight">
              tap to watch
            </span>
          </div>
        </div>
      )}

      {/* ---------- Cryo-Stop: рынок предсказаний (task 41/42) ---------- */}
      {market && overlayUp && (
        <CryoStopCard
          market={market}
          videoRef={videoRef}
          active={isActive}
          onFrozen={handleFrozen}
          onPredicted={(side) => setPredicted(side)}
          onRelease={() => setMarketReleased(true)}
        />
      )}

      {/* ---------- PREDICTED / вердикт (task 42, пункты 4+8) ----------
          после выбора исхода карточка — обычное видео с лейблом;
          клик ведёт в pnl-кошелёк (позиции/клеймы) ---------- */}
      {market && !overlayUp && (
        <a
          href="/pnl"
          onClick={(e) => e.stopPropagation()}
          className={`nr-predict-chip ${
            predicted && market.status === "resolved" && market.result === predicted
              ? "nr-predict-chip-win"
              : ""
          }`}
          aria-label="Open pnl wallet"
        >
          {predicted ? (
            market.status === "resolved" && market.result ? (
              predicted === market.result ? (
                <>
                  ✓ PREDICTED · {cryoOptionLabel(market, predicted)}
                  <b>+${market.myPayout ?? "0.00"}</b>
                </>
              ) : (
                <>✓ PREDICTED · dissolved</>
              )
            ) : (
              <>✓ PREDICTED · {cryoOptionLabel(market, predicted)}</>
            )
          ) : market.status === "resolved" && market.result ? (
            <>verdict: {cryoOptionLabel(market, market.result)}</>
          ) : (
            <>❄ market closed</>
          )}
        </a>
      )}

      {/* ---------- звук (только у видео-карточек) ---------- */}
      {!isCarousel && !overlayUp && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const v = videoRef.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
          }}
          aria-label={muted ? "Unmute" : "Mute"}
          className="nr-glass absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full text-[#10161d] transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(16,22,29,.3)]"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {/* ---------- левый верхний ряд: скрепка + профиль автора ----------
          скрепка копирует deep-link /v/[code] (wiggle цепляет взгляд);
          профиль — круглая кнопка правее скрепки, ведёт на @author в Threads.
          У бустнутых постов — жемчужный shimmer-ранг вместо обычного стекла.
          pointer-events-none на обёртке: клики в зазорах уходят в видео ---------- */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
        {!overlayUp && (
        <>
        <button
          onClick={copyInternal}
          aria-label={linkCopied ? "Link copied" : "Copy the link to this video"}
          className={`nr-glass pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-[#10161d] transition-[transform,box-shadow] duration-300 hover:-rotate-6 hover:scale-[1.08] hover:shadow-[0_0_20px_rgba(16,22,29,.3)] active:scale-90 ${
            linkCopied ? "nr-anim-copied nr-ring-glow" : ""
          }`}
        >
          {linkCopied ? (
            <Check key="check" className="nr-anim-morph h-4 w-4" />
          ) : (
            <Paperclip key="clip" className="nr-clip-wiggle h-4 w-4" />
          )}
        </button>

        {authorHandle && (
          <a
            href={`https://www.threads.com/@${authorHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              /* посты партнёра недели: переход на профиль мяукает */
              if (PARTNER_OF_WEEK.donatePostUtms.includes(post.utmCode))
                playMeow();
              if (!guarded(800)) e.preventDefault(); // флуд-контроль
            }}
            aria-label={`Open ${post.author} profile on Threads`}
            className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full p-[2px] transition-transform duration-300 hover:scale-[1.08] active:scale-95 ${
              boosted ? "nr-author-btn nr-anim-hint" : "nr-glass"
            }`}
          >
            <span
              className={`flex h-full w-full items-center justify-center rounded-full ${
                boosted ? "bg-white" : ""
              }`}
            >
              <AtSign className="h-4 w-4 text-[#0a0a0a]" />
            </span>
          </a>
        )}

        {/* ---------- избранное (task 43): сердце после авторизации кошелька ----------
            без сессии тап открывает connect-флоу кошелька; с сессией —
            мгновенный оптимистичный тоггл + взрыв сердец (nr-fav-burst) ---------- */}
        <button
          onClick={(e) => void onHeart(e)}
          aria-pressed={favOn}
          aria-label={
            favOn ? "Remove from favorites" : "Add to favorites"
          }
          title={
            favs.authNeeded && !favOn
              ? "connect a wallet to save favorites"
              : undefined
          }
          className={`nr-fav-btn nr-glass pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full transition-[transform,box-shadow] duration-300 hover:scale-[1.08] active:scale-90 ${
            favOn ? "nr-fav-on" : ""
          }`}
        >
          <Heart
            className={`h-4 w-4 ${favOn ? "nr-fav-heart" : "text-[#10161d]"}`}
          />
          {favBurst > 0 && (
            <span key={favBurst} className="nr-fav-burst" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <i key={i} style={{ ["--fi" as string]: i }} />
              ))}
              <b />
            </span>
          )}
        </button>
        {/* ---------- счётчик избранного (task 44, §3):
            «N авторизованных добавили» — социальное доказательство;
            виден всем, рендерится только когда есть кого показывать ---------- */}
        {favCount > 0 && !market && (
          <span
            aria-label={`${favCount} members saved this video to favorites`}
            className="nr-glass pointer-events-none flex max-w-[3.4rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[0.55rem] font-extrabold leading-tight text-[#10161d]/80"
          >
            {favCount > 999 ? "1k+" : favCount} saved
          </span>
        )}
        </>
        )}
      </div>

      {/* ---------- анимированный бейдж (CREEPY / SWAG / UFO / ROCKET) ---------- */}
      {post.badge && (
        <div
          className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${
            /* UFO-бейдж компактный: центрирован по линии верхних кнопок (в ряд) */
            post.badge === "WELCOME TO THE FUTURE" ? "top-[21px]" : "top-3"
          } ${post.badge === "SWAG" ? "nr-swag-wrap" : ""}`}
        >
          <span
            className={`inline-flex items-center rounded-full bg-[#0a0a0a] font-black text-white ${
              post.badge === "SWAG"
                ? "nr-swag-badge gap-2 px-3.5 py-1.5 text-[0.62rem] tracking-[0.24em]"
                : post.badge === "CREEPY"
                  ? "nr-creepy-badge gap-2 px-3.5 py-1.5 text-[0.62rem] tracking-[0.24em]"
                  : post.badge === "WELCOME TO THE FUTURE"
                    ? /* компактная пилюля (~180px): влезает в ряд кнопок на 390px */
                      "nr-ufo-badge gap-1.5 px-2.5 py-1 text-[0.55rem] tracking-[0.08em]"
                    : post.badge === "ROCKET SCIENCE"
                      ? "nr-rocket-badge gap-2 px-3.5 py-1.5 text-[0.62rem] tracking-[0.24em]"
                      : "gap-2 px-3.5 py-1.5 text-[0.62rem] tracking-[0.24em]"
            }`}
          >
            {post.badge === "WELCOME TO THE FUTURE" && (
              <i className="nr-ufo nr-ufo-sm" aria-hidden="true" />
            )}
            {post.badge === "ROCKET SCIENCE" && (
              <svg className="nr-rocket" viewBox="0 0 12 24" aria-hidden="true">
                <path
                  className="nr-rocket-flame"
                  fill="#ffffff"
                  d="M6 19.2 C4.6 20.8 4.6 22.6 6 24 C7.4 22.6 7.4 20.8 6 19.2 Z"
                />
                <path
                  fill="#e8ecf0"
                  d="M6 0 C8.4 2.4 9 5.8 9 8.8 L9 14.5 L3 14.5 L3 8.8 C3 5.8 3.6 2.4 6 0 Z"
                />
                <circle cx="6" cy="7.6" r="1.55" fill="#0a0a0a" />
                <path fill="#9aa2ab" d="M3 10.8 L0.6 15.2 L3 16.6 Z" />
                <path fill="#9aa2ab" d="M9 10.8 L11.4 15.2 L9 16.6 Z" />
              </svg>
            )}
            {post.badge}
          </span>
        </div>
      )}

      {/* ---------- ошибка загрузки (старый текстовый фолбэк убран:
          теперь сцену SIGNAL LOST рисует VideoFallback) ---------- */}

      {/* ---------- glass-статус: живёт в DOM, анимация через transition ---------- */}
      <div
        aria-hidden={!statusShown}
        className={`absolute bottom-[5.5rem] left-3 right-3 z-20 transition-all duration-500 ease-out sm:right-auto sm:max-w-md ${
          statusShown
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0 blur-xs"
        }`}
      >
        <div className={`nr-glass-deep rounded-2xl px-4 py-3 ${boosted ? "nr-boost-panel" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-[#0a0a0a]">
              {post.author || "unknown"}
            </span>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-white/75 px-2 py-0.5 text-[0.65rem] font-bold text-[#0a0a0a]">
              <TrendingUp className="h-3 w-3" />
              {post.score}
            </span>
          </div>
          {post.title && (
            <p
              className={`nr-status-shadow mt-1 line-clamp-2 text-[0.78rem] leading-snug ${
                boosted
                  ? "nr-boost-desc font-semibold"
                  : "text-[#10161d]/85"
              }`}
            >
              {post.title}
            </p>
          )}
        </div>
      </div>

      {/* ---------- нижний левый ряд: Share Reality + Threads ----------
          одна линия с кнопкой промпта (гаечный ключ) справа:
          оба ряда стоят на bottom-[2rem] — параллельно друг другу ---------- */}
      {!overlayUp && (
      <div className="absolute bottom-[2rem] left-3 z-20 flex items-center gap-2">
        {/* Share Reality — главный CTA */}
        <button
          onClick={copyUtm}
          aria-label="Copy the UTM link to boost this video in the feed"
          className={`flex items-center gap-2 rounded-full bg-[#0a0a0a] px-4 py-2.5 text-[0.75rem] font-bold text-white transition-[box-shadow,transform] duration-300 hover:scale-[1.03] active:scale-95 sm:text-[0.8rem] ${
            copied ? "nr-anim-copied nr-ring-glow" : "nr-btn-glow"
          }`}
        >
          {copied ? (
            <span
              key="check"
              className="nr-anim-morph flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              copied
            </span>
          ) : (
            <span
              key="share"
              className="nr-anim-morph flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              share reality
            </span>
          )}
        </button>

        {/* открыть в Threads — через /r/[code], клик засчитывается */}
        <a
          href={`/r/${post.utmCode}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            if (!guarded(1000)) e.preventDefault(); // флуд-контроль вкладок
          }}
          aria-label="Open this video on Threads"
          className="nr-glass relative flex items-center gap-2 rounded-full px-4 py-2 text-[0.72rem] font-bold text-[#0a0a0a] transition-transform duration-300 hover:scale-[1.04] active:scale-95 sm:text-[0.78rem]"
        >
          {/* счётчик просмотров — чип у стрелки */}
          <span
            className="nr-views-chip pointer-events-none absolute -left-2 -top-2.5 flex items-center gap-1 rounded-full bg-[#0a0a0a] px-1.5 py-[3px] text-[0.55rem] font-bold leading-none tracking-normal text-white"
            aria-hidden="true"
          >
            <Eye className="h-2.5 w-2.5" />
            {viewsLabel}
          </span>
          <ArrowUpRight className="h-4 w-4 text-[#0a0a0a]" />
          threads
        </a>
      </div>
      )}

      {/* ---------- панель промпта: разблокированный / бесплатный / заглушка ---------- */}
      {promptOpen && (
        <div
          role="dialog"
          aria-label="Prompt"
          onClick={(e) => e.stopPropagation()}
          className="nr-anim-hint absolute bottom-[12rem] right-3 left-3 z-30 sm:left-auto sm:max-w-sm"
        >
          <div className="nr-glass-deep rounded-2xl px-4 py-3.5">
            {panelMode === "soon" ? (
              <>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-[#3d7db8]" />
                  <span className="text-[0.82rem] font-bold tracking-tight text-[#0a0a0a]">
                    Prompt coming soon
                  </span>
                </div>
                <p className="mt-1.5 text-[0.75rem] leading-relaxed text-[#10161d]/80">
                  Soon you&apos;ll be able to watch the exact prompt used to generate
                  this video — and reuse it to create your own.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {panelMode === "unlocked" ? (
                    <Sparkles className="h-4 w-4 shrink-0 text-[#3d7db8]" />
                  ) : (
                    <Copy className="h-4 w-4 shrink-0 text-[#3d7db8]" />
                  )}
                  <span className="text-[0.82rem] font-bold tracking-tight text-[#0a0a0a]">
                    {panelMode === "unlocked" ? "Your prompt" : "Prompt"}
                  </span>
                  {panelMode === "unlocked" && (
                    <span className="ml-auto rounded-full bg-[#0a0a0a] px-2 py-0.5 text-[0.55rem] font-black tracking-[0.14em] text-white">
                      UNLOCKED
                    </span>
                  )}
                </div>
                <p
                  className={`nr-unlock-reveal mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[0.72rem] leading-relaxed text-[#10161d]/90 ${
                    unlocked ? "" : ""
                  }`}
                >
                  {effectivePrompt}
                </p>
                <button
                  onClick={copyPromptText}
                  className={`mt-2.5 flex items-center gap-2 rounded-full bg-[#0a0a0a] px-3.5 py-2 text-[0.7rem] font-bold text-white transition-transform duration-300 hover:scale-[1.03] active:scale-95 ${
                    promptCopied ? "nr-anim-copied nr-ring-glow" : ""
                  }`}
                >
                  {promptCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      copy prompt
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- кнопка промпта: замок (платный) / ключ (разблокирован) / гаечный ключ ----------
          sonar-ping привлекает внимание; платный закрытый промпт открывает модалку оплаты ---------- */}
      {!overlayUp && (
      <button
        onClick={togglePrompt}
        aria-expanded={promptOpen || modalOpen}
        aria-label={
          lockedPrompt
            ? `Unlock the prompt for ${post.priceUsdt ?? "3.00"} USDT`
            : "Reveal prompt for this video"
        }
        className={`nr-glass absolute bottom-[2rem] right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full text-[#10161d] transition-transform duration-300 hover:rotate-12 hover:scale-[1.08] active:scale-95 ${
          lockedPrompt ? "nr-play-pulse" : ""
        }`}
      >
        {lockedPrompt ? (
          <Lock className="h-4 w-4 text-[#0a0a0a]" />
        ) : panelMode === "unlocked" ? (
          <Sparkles className="h-4 w-4 text-[#0a0a0a]" />
        ) : (
          <Wrench className="h-4 w-4 text-[#0a0a0a]" />
        )}
      </button>
      )}

      {/* ---------- пилот 2328.io: крипто-донат на постах партнёра недели ---------- */}
      {PARTNER_OF_WEEK.donatePostUtms.includes(post.utmCode) &&
        PARTNER_OF_WEEK.donatePresetsUsdt.length > 0 &&
        !overlayUp && (
          <DonateBox utmCode={post.utmCode} autoOpen={autoDonate} />
        )}

      {/* ---------- v2: панель ставки REAL/SYNTH (ТЗ §1, §3.1) ----------
          только на клипах с curator truth (bettable) и без Cryo-оверлея:
          два рынка на один кадр — каша. Панель сама прячется у неактивных. */}
      {post.bettable && !market && (
        <div onClick={(e) => e.stopPropagation()}>
          <BetPanel
            clipCode={post.utmCode}
            isActive={isActive}
            landHard={landHard}
          />
        </div>
      )}

      {/* ---------- вспышка разблокировки: кольцо + конфетти ---------- */}
      {unlockFlash && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-40">
          <div className="nr-unlock-ring" />
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="nr-unlock-confetti"
              style={{
                ["--dx" as string]: p.dx,
                ["--dy" as string]: p.dy,
                ["--rot" as string]: p.rot,
                ["--c" as string]: p.c,
                ["--d" as string]: p.d,
              }}
            />
          ))}
        </div>
      )}

      {/* ---------- модалка оплаты (2328.io hosted checkout) ---------- */}
      {modalOpen && (
        <UnlockModal
          utmCode={post.utmCode}
          author={post.author}
          title={post.title}
          priceUsdt={post.priceUsdt}
          preview={post.promptPreview}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* ---------- выразительный прогресс-бар (только видео; у карусели — stories-сегменты) ---------- */}
      {!isCarousel && !overlayUp && (
        <ProgressBar
          videoRef={videoRef}
          active={isActive}
          onSeek={seekWithBg}
          onScrubStart={() => showStatus(false)}
          onScrubEnd={hideStatusSoon}
        />
      )}
    </section>
  );
}

/*
 * memo (task 43): лента поллит рынки каждые 8с — без memo каждый ответ
 * перерисовывал бы все 45 карточек. Props стабильны: post — те же объекты
 * из SSR-props, onEnded — один useCallback c индексом, market — null у
 * обычных карточек. Перерисовываются только карточки с реально
 * изменившимся рынком.
 */
export default memo(VideoCardInner);
