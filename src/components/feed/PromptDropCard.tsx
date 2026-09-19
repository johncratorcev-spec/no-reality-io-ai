"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Link2, Loader2, Lock, Sparkles, PawPrint } from "lucide-react";
import { MARKET, PROMPT_DROP, REFERRAL } from "@/lib/site";
import { useWalletSession } from "@/lib/use-wallet";

/* ================================================================
   PROMPT DROP — реклама продажи промпта персонажа коллаба
   (чёрный кот в толстовке «LOKI», кадр 13.4с из коллаб-видео).

   Flash-механика: оплата инвойса $100 → промпт показывается
   PROMPT_DROP.revealSeconds секунд → исчезает (blur-выцветание).
   Один платёж = один взгляд; смотрим честно, скриншотим быстро.

   Stateless: orderId живёт в sessionStorage (переживает same-tab
   редирект на чекаут и возврат по url_return), статус реконслируем
   у 2328.io каждые 4с. Никаких cookies/БД.
   ================================================================ */

const ORDER_KEY = "nr-pd-order";
const POLL_MS = 4000;
const POLL_MAX_MS = 45 * 60_000; // TTL инвойса в 2328 = 30 мин + запас

type Phase = "idle" | "invoicing" | "awaiting" | "revealed" | "gone";

interface PromptDropCardProps {
  /** feed — полноэкранная snap-карточка ленты; section — блок страницы /collab */
  variant?: "feed" | "section";
}

export default function PromptDropCard({
  variant = "feed",
}: PromptDropCardProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(PROMPT_DROP.revealSeconds);
  const [vanishing, setVanishing] = useState(false);
  const [cardCopied, setCardCopied] = useState(false);
  const pollStart = useRef(0);
  const { shareRefCode } = useWalletSession();

  /** код из localStorage — пригласивший, чьей ссылкой покупатель пришёл */
  const storedRef = useCallback((): string | null => {
    try {
      const saved = localStorage.getItem(REFERRAL.storageKey);
      return saved && /^r[a-z0-9]{5,11}$/.test(saved) ? saved : null;
    } catch {
      return null;
    }
  }, []);

  /* --- возврат после чекаута: подхватываем инвойс из sessionStorage ---
     setState отложен в rAF: гидратация отрисовывает idle, resume — следом */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const saved = sessionStorage.getItem(ORDER_KEY);
        if (saved) {
          setOrderId(saved);
          pollStart.current = Date.now();
          setPhase("awaiting");
        }
      } catch {
        /* private mode — просто продаём без resume */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const discard = useCallback((msg?: string) => {
    try {
      sessionStorage.removeItem(ORDER_KEY);
    } catch {}
    setOrderId(null);
    setPayUrl(null);
    setPhase("idle");
    if (msg) setError(msg);
  }, []);

  /* --- покупка: инвойс $100 у 2328.io → редирект на hosted checkout --- */
  const buy = useCallback(async () => {
    setError(null);
    setPhase("invoicing");
    try {
      const r = await fetch("/api/prompt-drop/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: storedRef() }),
      });
      const d = (await r.json()) as {
        payUrl?: string;
        orderId?: string;
        error?: string;
      };
      if (!r.ok || !d.payUrl || !d.orderId) {
        setError(d.error || "Could not start the payment — try again soon.");
        setPhase(orderId ? "awaiting" : "idle");
        return;
      }
      try {
        sessionStorage.setItem(ORDER_KEY, d.orderId);
      } catch {}
      pollStart.current = Date.now();
      setOrderId(d.orderId);
      setPayUrl(d.payUrl);
      setPhase("awaiting");
      /* same-tab: url_return вернёт покупателя на /v/<collab>?drop=1 */
      window.location.href = d.payUrl;
    } catch {
      setError("Network error — please try again.");
      setPhase(orderId ? "awaiting" : "idle");
    }
  }, [orderId]);

  /* --- поллинг статуса инвойса --- */
  useEffect(() => {
    if (phase !== "awaiting" || !orderId) return;

    let stopped = false;
    let timer = 0;

    const poll = async () => {
      if (stopped) return;
      if (Date.now() - pollStart.current > POLL_MAX_MS) {
        discard("The invoice timed out — start again.");
        return;
      }
      try {
        const r = await fetch(
          `/api/prompt-drop/status?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const d = (await r.json()) as {
          paid?: boolean;
          prompt?: string | null;
          dead?: boolean;
          error?: string;
        };
        if (d.paid && d.prompt) {
          try {
            sessionStorage.removeItem(ORDER_KEY);
          } catch {}
          setPrompt(d.prompt);
          setSecondsLeft(PROMPT_DROP.revealSeconds);
          setVanishing(false);
          setPhase("revealed");
          return;
        }
        if (d.dead) {
          discard("The invoice is no longer payable — start again.");
          return;
        }
      } catch {
        /* сеть моргнула / 429 — попробуем на следующем тике */
      }
      timer = window.setTimeout(poll, POLL_MS);
    };

    timer = window.setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [phase, orderId, discard]);

  /* --- 60-секундный отсчёт показа: тик 250мс, ring обновляется сам --- */
  useEffect(() => {
    if (phase !== "revealed") return;
    const totalMs = PROMPT_DROP.revealSeconds * 1000;
    const t0 = Date.now();
    let timer = 0;

    const tick = () => {
      const left = Math.max(0, totalMs - (Date.now() - t0));
      setSecondsLeft(Math.ceil(left / 1000));
      if (left <= 0) {
        setVanishing(true);
        timer = window.setTimeout(() => {
          setPrompt(null);
          setVanishing(false);
          setPhase("gone");
        }, 1050);
        return;
      }
      timer = window.setTimeout(tick, 250);
    };

    tick();
    return () => window.clearTimeout(timer);
  }, [phase]);

  /* ================= визуал ================= */

  const pct = Math.round((secondsLeft / PROMPT_DROP.revealSeconds) * 100);

  /* --- ссылки задачи №2: источник персонажа + сама карточка --- */
  const copyCardLink = useCallback(async () => {
    const ref = shareRefCode();
    const url = `${window.location.origin}${MARKET.path}${
      ref ? `?ref=${ref}` : ""
    }#${MARKET.itemAnchor}`;
    try {
      await navigator.clipboard.writeText(url);
      setCardCopied(true);
      setTimeout(() => setCardCopied(false), 1800);
    } catch {
      /* clipboard запрещён — молча */
    }
  }, [shareRefCode]);

  const linksRow = (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <a
        href={`/v/${PROMPT_DROP.afterUtm}`}
        className="inline-flex items-center gap-1.5 text-[0.66rem] font-extrabold text-[#10161d]/55 underline decoration-[#10161d]/25 underline-offset-4 transition-colors hover:text-[#e4713b]"
      >
        <ExternalLink className="h-3 w-3" aria-hidden />
        watch the collab video
      </a>
      <button
        onClick={copyCardLink}
        className="inline-flex items-center gap-1.5 text-[0.66rem] font-extrabold text-[#10161d]/55 underline decoration-[#10161d]/25 underline-offset-4 transition-colors hover:text-[#e4713b]"
      >
        <Link2 className="h-3 w-3" aria-hidden />
        {cardCopied ? "card link copied ✓" : "copy card link"}
      </button>
    </div>
  );

  const ring = (
    <span className="relative inline-flex h-12 w-12 items-center justify-center" aria-hidden>
      <span
        className="nr-pd-ring absolute inset-0 rounded-full"
        style={{ ["--p" as string]: String(pct) }}
      />
      <span className="absolute inset-[3px] rounded-full bg-white" />
      <span className="relative font-mono text-sm font-extrabold text-[#e4713b]">
        {secondsLeft}
      </span>
    </span>
  );

  const priceRow = (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-3xl font-extrabold tracking-tight text-[#0a0a0a]">
        $100
      </span>
      <span className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#10161d]/50">
        one look · 60 seconds · then it&apos;s gone
      </span>
    </div>
  );

  /* --- фаза: промпт раскрыт (общая для обоих вариантов) --- */
  const revealBlock = (
    <div className={vanishing ? "nr-pd-vanish" : "nr-pd-pop"}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-[#c26d3f]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          the loki prompt — paid &amp; unlocked
        </p>
        {ring}
      </div>
      <div className="nr-pd-scroll mt-3 max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[#10161d]/10 bg-[#10161d]/[0.04] p-4 font-mono text-[0.72rem] leading-relaxed text-[#10161d]/90 sm:max-h-[42vh]">
        {prompt}
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#10161d]/45">
        screenshot now — when the timer hits zero, it disappears for good.
      </p>
    </div>
  );

  /* --- фазы покупки (общие) --- */
  const buyBlock = (
    <>
      {priceRow}

      {phase === "idle" && (
        <>
          <button
            onClick={buy}
            className="nr-pd-cta mt-5 inline-flex items-center gap-2 rounded-full bg-[#e4713b] px-7 py-3.5 text-[0.85rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
          >
            <Lock className="h-4 w-4" aria-hidden />
            get the prompt — $100
          </button>
          <p className="mt-2.5 text-[0.6rem] font-semibold text-[#10161d]/45">
            crypto checkout via 2328.io · one payment, one 60-second look
          </p>
        </>
      )}

      {phase === "invoicing" && (
        <p className="mt-5 flex items-center gap-2 text-[0.78rem] font-bold text-[#10161d]/70">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          opening checkout…
        </p>
      )}

      {phase === "awaiting" && (
        <>
          <p className="mt-5 flex items-center gap-2 text-[0.78rem] font-bold text-[#10161d]/80">
            <Loader2 className="h-4 w-4 animate-spin text-[#e4713b]" aria-hidden />
            waiting for your payment — we check every 4s…
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {payUrl && (
              <a
                href={payUrl}
                className="inline-flex items-center gap-2 rounded-full bg-[#10161d]/5 px-5 py-2.5 text-[0.72rem] font-extrabold text-[#10161d] ring-1 ring-[#10161d]/15 transition-colors hover:bg-[#10161d]/10"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                reopen checkout
              </a>
            )}
            <button
              onClick={() => discard()}
              className="text-[0.68rem] font-bold text-[#10161d]/40 transition-colors hover:text-[#10161d]/75"
            >
              cancel
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-[#ff5470]/10 px-3 py-2 text-[0.7rem] font-semibold leading-snug text-[#d63d5e]">
          {error}
        </p>
      )}
    </>
  );

  const goneBlock = (
    <div className="nr-pd-pop">
      <p className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#0a0a0a]">
        gone. <PawPrint className="h-5 w-5 text-[#e4713b]" aria-hidden />
      </p>
      <p className="mt-2 max-w-sm text-[0.78rem] font-semibold leading-relaxed text-[#10161d]/55">
        60 seconds is 60 seconds — the cat keeps its secrets. but you know
        where to find another look.
      </p>
      <button
        onClick={buy}
        className="nr-pd-cta mt-4 inline-flex items-center gap-2 rounded-full bg-[#e4713b] px-6 py-3 text-[0.78rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
      >
        <Lock className="h-4 w-4" aria-hidden />
        get another look — $100
      </button>
    </div>
  );

  /* ================= оболочки ================= */

  if (variant === "section") {
    return (
      <section
        id={MARKET.itemAnchor}
        className="mx-auto max-w-4xl scroll-mt-16 px-5 py-20 sm:py-24"
        aria-label="Prompt drop — loki"
      >
        <div className="nr-pd-shell grid items-center gap-8 overflow-hidden rounded-[2.5rem] border border-[#a8cfea]/50 bg-gradient-to-br from-white via-[#f7f9fd] to-[#eef5fb] p-6 text-[#10161d] shadow-[0_24px_70px_rgba(61,125,184,0.16)] sm:grid-cols-[minmax(0,300px)_1fr] sm:p-10">
          <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl">
            <img
              src={PROMPT_DROP.image}
              alt="loki — the black cat in the hoodie, a frame from the collab video"
              loading="lazy"
              className="nr-pd-ken aspect-[9/16] w-full object-cover"
            />
            <div className="nr-pd-sweep pointer-events-none absolute inset-0" aria-hidden />
          </div>

          <div>
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#c26d3f]">
              prompt drop · flash sale
            </p>
            <h2 className="nr-collab-shimmer mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              the cat from the collab
            </h2>
            {phase === "revealed" ? (
              <div className="mt-5">
                {revealBlock}
              </div>
            ) : phase === "gone" ? (
              <div className="mt-5">{goneBlock}</div>
            ) : (
              <>
                <p className="mt-4 max-w-md text-[0.86rem] font-semibold leading-relaxed text-[#10161d]/65">
                  that&apos;s loki — the black cat in the hoodie from the collab
                  clip. the exact prompt that generates this character is up for
                  grabs, right now, for one honest price.
                </p>
                <div className="mt-5">{buyBlock}</div>
                {linksRow}
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* feed: полноэкранная snap-карточка (светлая тема) */
  return (
    <div className="relative h-full w-full overflow-hidden bg-white text-[#10161d]">
      <div className="absolute inset-0" aria-hidden>
        <img
          src={PROMPT_DROP.image}
          alt=""
          loading="lazy"
          className="nr-pd-ken h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/72 to-white/10" />
        <div className="nr-pd-sweep absolute inset-0" />
      </div>

      <div className="relative flex h-full flex-col justify-end p-6 pb-16">
        {phase === "revealed" ? (
          revealBlock
        ) : phase === "gone" ? (
          goneBlock
        ) : (
          <>
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#c26d3f]">
              prompt drop · flash sale
            </p>
            <h2 className="nr-collab-shimmer mt-3 max-w-md text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              the cat from the collab
            </h2>
            <p className="mt-3 max-w-md text-[0.86rem] font-semibold leading-relaxed text-[#10161d]/70">
              that&apos;s loki — the black cat in the hoodie. the exact prompt
              that generates this character is on sale, right here, right now.
            </p>
            <div className="mt-6">{buyBlock}</div>
            {linksRow}
          </>
        )}
      </div>
    </div>
  );
}
