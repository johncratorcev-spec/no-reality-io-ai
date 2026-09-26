"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Share2, Wallet } from "lucide-react";
import { BET, fmtUsd } from "@/lib/bet/config";
import { withRef } from "@/lib/shareRef";
import { track } from "@/lib/bet/trackClient";
import { useWalletSession } from "@/lib/use-wallet";
import ShareSeam from "./ShareSeam";

/**
 * BetPanel v5 — панель предикшен-ленты (REAL / SYNTH + банк + таймер).
 *
 * Поток: свайп → клип активен → GET /api/round?clip= (лениво открывает раунд)
 * → тап REAL/SYNTH → сумма $1/$3/$5 → если кошелёк не подключён — сразу
 * connect (затем ставка продолжается сама) → «ТЫ В ПУЛЕ» → поллинг
 * /api/round/:id каждые ~1.5с → резолв → РЕЗУЛЬТАТ-КАРТА (вердикт + сумма +
 * deep link + «поделиться результатом» + «следующий»).
 *
 * Аналитика воронки: prediction_view / wallet_connect (в use-wallet) /
 * bet_placed (сервер) / share_result.
 */

type Side = "real" | "synth";

interface RoundView {
  id: string;
  clipCode: string;
  status: "open" | "locked" | "resolved";
  closesAt: string;
  serverNow: string;
  windowSec: number;
  poolRealCents: number;
  poolSynthCents: number;
  poolTotalCents: number;
  myBet: { side: Side; amountCents: number; status: string; payoutCents: number | null } | null;
  resolvedAs?: Side;
  myResult?: "won" | "lost" | null;
  myPayoutCents?: number | null;
}

interface BetPanelProps {
  clipCode: string;
  isActive: boolean;
  /** deep-link вход (/v/CODE) — land-hard */
  landHard?: boolean;
  /** «следующий» после резолва — лента сама знает куда скроллить */
  onNext?: () => void;
}

const STREAK_KEY = "nr-streak";

function readStreak(): number {
  try {
    return Number(sessionStorage.getItem(STREAK_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeStreak(v: number) {
  try {
    sessionStorage.setItem(STREAK_KEY, String(v));
  } catch {
    /* приватный режим */
  }
}

/** весь кадр: crush / glitch-eye (слушает VideoCard на корневой секции) */
function crashFrame(clip: string, kind: "nb-crush" | "nb-glitch") {
  try {
    window.dispatchEvent(new CustomEvent(kind, { detail: { clip } }));
  } catch {
    /* нет — нет */
  }
}

export default function BetPanel({ clipCode, isActive, landHard, onNext }: BetPanelProps) {
  const { wallet, ready: walletReady, connecting: walletConnecting, error: walletError, connect } =
    useWalletSession();

  const [round, setRound] = useState<RoundView | null>(null);
  const [phase, setPhase] = useState<"idle" | "amount" | "connect" | "pending">("idle");
  const [chosenSide, setChosenSide] = useState<Side | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [flashLime, setFlashLime] = useState(0);
  const [flashBlood, setFlashBlood] = useState(0);
  const [bankKey, setBankKey] = useState(0);
  const [shake, setShake] = useState(0);
  const [chipIn, setChipIn] = useState(0);
  const [inPool, setInPool] = useState(0);
  const [activations, setActivations] = useState(0);
  const [wasActive, setWasActive] = useState(false);
  const [showTear, setShowTear] = useState(false);
  const [resultPop, setResultPop] = useState(0);
  const [shared, setShared] = useState(false);

  const skewRef = useRef(0);
  const settledRef = useRef(false);
  const clipRef = useRef(clipCode);
  clipRef.current = clipCode;

  /* ---- клип стал активным: открыть/поднять раунд ---- */
  useEffect(() => {
    if (!isActive) return;
    setActivations((a) => a + 1);
    setStreak(readStreak());
    settledRef.current = false;
    setError("");
    let alive = true;

    (async () => {
      try {
        const r = await fetch(`/api/round?clip=${encodeURIComponent(clipCode)}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          setRound(null);
          return;
        }
        const d = (await r.json()) as { round?: RoundView; error?: string };
        if (!alive) return;
        if (d.round) {
          skewRef.current = Date.now() - new Date(d.round.serverNow).getTime();
          setRound(d.round);
          setBankKey((k) => k + 1);
          if (d.round.myBet && d.round.status === "open") setPhase("pending");
          if (d.round.status === "resolved") settledRef.current = true;
        } else {
          setRound(null); // не bettable / недоступен — панель молчит
        }
      } catch {
        if (alive) setRound(null);
      }
    })();

    /* воронка v5: prediction_view (предикшен-лента) + legacy clip_view */
    track("prediction_view", clipCode);
    track("clip_view", clipCode);
    return () => {
      alive = false;
    };
  }, [isActive, clipCode]);

  /* ---- seam-tear: при деактивации карточки с панелью ---- */
  useEffect(() => {
    if (wasActive && !isActive) {
      setShowTear(true);
      const t = setTimeout(() => setShowTear(false), 340);
      return () => clearTimeout(t);
    }
    setWasActive(isActive);
  }, [isActive, wasActive]);

  const onSettled = useCallback((r: RoundView) => {
    const won = r.myResult === "won";
    if (r.myBet) {
      if (won) {
        const s = readStreak() + 1;
        writeStreak(s);
        setStreak(s);
      } else if (r.myResult === "lost") {
        writeStreak(0);
        setStreak(0);
      }
    }
    if (r.resolvedAs === "real") crashFrame(r.clipCode, "nb-glitch");
    if (r.myResult === "lost") crashFrame(r.clipCode, "nb-crush");
    setResultPop((p) => p + 1);
  }, []);

  /* ---- поллинг раунда, пока он жив и карточка активна (§4.3.5) ---- */
  useEffect(() => {
    if (!isActive || !round || round.status === "resolved") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (document.visibilityState !== "hidden") {
        try {
          const r = await fetch(`/api/round/${round.id}`, { cache: "no-store" });
          if (r.ok) {
            const d = (await r.json()) as { round?: RoundView };
            if (!stopped && d.round) {
              const prevTotal = round.poolTotalCents;
              setRound(d.round);
              if (d.round.poolTotalCents !== prevTotal) setBankKey((k) => k + 1);
              if (d.round.status === "resolved" && !settledRef.current) {
                settledRef.current = true;
                onSettled(d.round);
              }
            }
          }
        } catch {
          /* сеть моргнула — попробуем на следующем тике */
        }
      }
      if (!stopped) timer = setTimeout(tick, BET.pollMs);
    };

    timer = setTimeout(tick, BET.pollMs);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [isActive, round?.id, round?.status, round?.poolTotalCents, onSettled]);

  /* ---- ставка (кошелёк уже подключён или не нужен) ---- */
  const placeBet = async (amountCents: number) => {
    if (!round || !chosenSide) return;
    setError("");
    setChipIn((c) => c + 1);
    try {
      const ref = (() => {
        try {
          return localStorage.getItem("nr-ref");
        } catch {
          return null;
        }
      })();
      const r = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round_id: round.id,
          side: chosenSide,
          amount_cents: amountCents,
          ref: ref,
        }),
      });
      const d = (await r.json()) as {
        bet_id?: string;
        status?: string;
        mode?: string;
        pay_url?: string | null;
        round?: RoundView | null;
        error?: string;
      };
      if (!r.ok || d.error) {
        setError(d.error === "already_bet" ? "ставка уже в банке" : "банк не принял");
        setShake((s) => s + 1);
        return;
      }
      if (d.round) {
        setRound(d.round);
        setBankKey((k) => k + 1);
      }
      if (d.status === "pending" && d.pay_url) {
        setPayUrl(d.pay_url);
        try {
          window.open(d.pay_url, "_blank", "noopener");
        } catch {
          /* попап заблокирован — кнопка «оплатить» ниже */
        }
      }
      setPhase("pending");
      /* мгновенный фидбек «ТЫ В ПУЛЕ» — демо-ставка в пуле сразу */
      if (d.status === "active") {
        setInPool((v) => v + 1);
        setTimeout(() => setInPool(0), 1700);
      }
    } catch {
      setError("сеть дрогнула");
      setShake((s) => s + 1);
    }
  };

  /* ---- кошелёк подключился, пока ждали его перед ставкой — дожимаем ---- */
  useEffect(() => {
    if (!wallet || pendingAmount == null || !chosenSide) return;
    const amount = pendingAmount;
    const t = setTimeout(() => {
      setPendingAmount(null);
      void placeBet(amount);
    }, 0);
    return () => clearTimeout(t);
  }, [wallet, pendingAmount, chosenSide, placeBet]);

  const pickSide = (side: Side) => {
    setError("");
    setChosenSide(side);
    setPhase("amount");
    if (side === "real") setFlashLime((f) => f + 1);
    else setFlashBlood((f) => f + 1);
  };

  /** выбор суммы: если кошелёк не подключён — сначала connect, ставка дожмётся сама */
  const chooseAmount = (amountCents: number) => {
    if (!wallet && walletReady) {
      setPendingAmount(amountCents);
      setPhase("connect");
      void connect();
      return;
    }
    void placeBet(amountCents);
  };

  const again = () => {
    /* новый шов: перезапрашиваем раунд (старый уже resolved) */
    settledRef.current = false;
    setChosenSide(null);
    setPayUrl(null);
    setPhase("idle");
    (async () => {
      try {
        const r = await fetch(`/api/round?clip=${encodeURIComponent(clipRef.current)}`, {
          cache: "no-store",
        });
        if (r.ok) {
          const d = (await r.json()) as { round?: RoundView };
          if (d.round) {
            skewRef.current = Date.now() - new Date(d.round.serverNow).getTime();
            setRound(d.round);
            setBankKey((k) => k + 1);
          }
        }
      } catch {
        /* тишина */
      }
    })();
  };

  /* ---- Result / Share Card (v5): вердикт + сумма + deep link ---- */
  const shareResult = useCallback(async () => {
    const won = round?.myResult === "won";
    const asReal = round?.resolvedAs === "real";
    const url = withRef(`${window.location.origin}/v/${clipRef.current}`);
    const text = won
      ? `я угадал: это ${asReal ? "REAL" : "SYNTH"} · банк отдал мне ${fmtUsd(round?.myPayoutCents ?? 0)} — проверь свой глаз:`
      : `моя ставка не сыграла: это было ${asReal ? "REAL" : "SYNTH"}. угадай лучше меня:`;
    track("share_result", clipRef.current, { won, as: round?.resolvedAs });
    try {
      if (navigator.share) {
        await navigator.share({ title: "no reality.", text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
      }
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* отмена — не беда */
    }
  }, [round?.myResult, round?.resolvedAs, round?.myPayoutCents]);

  if (!isActive && !showTear) return null;

  /* ---- второй план: тики таймера ---- */
  const nowMs = Date.now() - skewRef.current;
  const closesMs = round ? new Date(round.closesAt).getTime() : 0;
  const remainingSec = round && round.status === "open" ? Math.max(0, (closesMs - nowMs) / 1000) : 0;
  const frac =
    round && round.status === "open"
      ? Math.max(0, Math.min(1, remainingSec / (round.windowSec || BET.windowSec)))
      : 0;
  const realShare =
    round && round.poolTotalCents > 0
      ? Math.round((round.poolRealCents / round.poolTotalCents) * 100)
      : 50;

  const result =
    round && round.status === "resolved"
      ? {
          as: round.resolvedAs,
          mine: round.myResult,
          payout: round.myPayoutCents ?? 0,
        }
      : null;

  const hasMyBet = Boolean(round?.myBet && ["active", "pending", "won", "lost"].includes(round.myBet.status));

  return (
    <>
      {/* ---------- вуаль iris-cut при активации кадра ---------- */}
      {isActive && activations > 0 && (
        <div
          key={`iris-${activations}`}
          aria-hidden
          className="nb-iris-veil nb-iris-run"
        />
      )}

      {/* ---------- seam-tear при уходе ---------- */}
      {showTear && <div aria-hidden className="nb-tear-veil" />}

      {/* ---------- blood-flash на тапе SYNTH ---------- */}
      {flashBlood > 0 && (
        <div key={`blood-${flashBlood}`} aria-hidden className="nb-blood-flash" />
      )}

      {/* ---------- «ТЫ В ПУЛЕ» — мгновенный фидбек (v5) ---------- */}
      {inPool > 0 && (
        <div
          key={`pool-${inPool}`}
          className="nb-pool-pop pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
        >
          <span
            className="rounded-2xl px-6 py-4 text-[1.25rem] font-black tracking-[0.06em]"
            style={{
              background: "rgba(8,7,11,0.88)",
              border: "1px solid rgba(200,255,0,.5)",
              color: "var(--nb-poison)",
              boxShadow: "0 0 44px rgba(200,255,0,.25)",
            }}
          >
            ТЫ В ПУЛЕ · {fmtUsd(round?.myBet?.amountCents ?? 0)}{" "}
            {round?.myBet?.side.toUpperCase() === "REAL" ? "REAL" : "SYNTH"}
          </span>
        </div>
      )}

      {/* ---------- РЕЗУЛЬТАТ / SHARE CARD (резолв) ---------- */}
      {result && (
        <div
          key={`verdict-${resultPop}`}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4"
        >
          <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3 text-center">
            {/* сама карта результата */}
            <div
              className={`nb-panel w-full rounded-3xl px-6 py-6 ${result.mine === "lost" ? "nb-crush" : ""}`}
            >
              <p
                className="text-[0.6rem] font-black uppercase tracking-[0.3em]"
                style={{ color: "rgba(242,237,228,.45)" }}
              >
                verdict
              </p>
              <p
                className="nb-bone-reveal mt-2 text-[2rem] font-black leading-none"
                style={{ color: result.as === "real" ? "var(--nb-bone)" : "var(--nb-blood)" }}
              >
                {result.as === "real" ? "ЭТО БЫЛО ЖИВОЕ" : "ЭТО СИНТЕТИКА"}
              </p>

              <div
                className="mx-auto mt-4 h-px w-16"
                style={{ background: "rgba(242,237,228,.18)" }}
              />

              {result.mine === "won" && (
                <p className="mt-4 text-[1.05rem] font-black" style={{ color: "var(--nb-poison)" }}>
                  твой глаз сработал · +{fmtUsd(result.payout)}
                </p>
              )}
              {result.mine === "lost" && (
                <p className="mt-4 text-[0.95rem] font-extrabold" style={{ color: "rgba(242,237,228,.72)" }}>
                  {fmtUsd(round?.myBet?.amountCents ?? 0)} ушли в банк
                </p>
              )}
              {!result.mine && (
                <p className="mt-4 text-[0.85rem] font-bold" style={{ color: "rgba(242,237,228,.55)" }}>
                  ты не ставил — заходи в следующий шов
                </p>
              )}

              {streak >= 2 && result.mine === "won" && (
                <p
                  className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-black tracking-[0.14em]"
                  style={{
                    background: "rgba(200,255,0,.12)",
                    color: "var(--nb-poison)",
                    border: "1px solid rgba(200,255,0,.35)",
                  }}
                >
                  серия ×{streak}
                </p>
              )}
            </div>

            {/* молния discharge — только победа */}
            {result.mine === "won" && (
              <svg
                aria-hidden
                viewBox="0 0 120 60"
                className="nb-discharge pointer-events-none absolute h-24 w-72"
                fill="none"
              >
                <path d="M4 8 L50 30 L38 34 L116 52" stroke="var(--nb-poison)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M20 2 L60 22" stroke="var(--nb-bone)" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
              </svg>
            )}

            {/* царапины crow-scratch — проигрыш на синтетике */}
            {result.mine === "lost" && result.as === "synth" && (
              <svg
                aria-hidden
                viewBox="0 0 120 60"
                className="nb-scratch pointer-events-none absolute h-24 w-72"
                fill="none"
              >
                <line x1="6" y1="14" x2="112" y2="40" stroke="var(--nb-blood)" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="14" y1="46" x2="100" y2="8" stroke="var(--nb-blood)" strokeWidth="1" strokeLinecap="round" />
                <line x1="40" y1="4" x2="86" y2="56" stroke="var(--nb-blood)" strokeWidth="0.8" strokeLinecap="round" />
              </svg>
            )}

            {/* CTA (v5): следующий + поделиться результатом + ещё шов */}
            <div className="flex w-full flex-col items-stretch gap-2">
              {onNext && (
                <button
                  onClick={onNext}
                  className="nb-btn w-full rounded-full px-5 py-3 text-[0.85rem] font-black"
                  style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
                >
                  следующий →
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void shareResult()}
                  className="nb-btn nb-btn-real inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[0.74rem] font-bold"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shared ? "ссылка скопирована" : "поделиться результатом"}
                </button>
                <button
                  onClick={again}
                  className="nb-btn nb-btn-real rounded-full px-4 py-2.5 text-[0.74rem] font-bold"
                >
                  ещё шов
                </button>
              </div>
              <div className="flex items-center justify-center gap-3">
                <ShareSeam mode="invite" className="nb-btn nb-btn-real rounded-full px-4 py-2 text-[0.68rem] font-bold" />
                <a
                  href="/pnl"
                  className="text-[0.64rem] font-bold underline decoration-dotted underline-offset-4"
                  style={{ color: "rgba(242,237,228,.5)" }}
                >
                  кэшаут — в pnl
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- ПАНЕЛЬ СТАВКИ ---------- */}
      {round && !result && (
        <div
          className={`pointer-events-none absolute bottom-[4.6rem] left-3 right-3 z-30 sm:left-auto sm:max-w-md ${
            isActive && landHard && activations === 1 ? "nb-land" : ""
          }`}
        >
          <div
            key={shake}
            className={`nb-panel pointer-events-auto rounded-2xl px-3.5 py-3 ${shake > 0 ? "nb-shake" : ""}`}
          >
            {/* строка банка */}
            <div className="flex items-center gap-2.5">
              {/* диафрагма таймера */}
              <svg
                aria-hidden
                viewBox="0 0 36 36"
                className={`nb-diaphragm h-9 w-9 shrink-0 ${remainingSec <= 10 ? "nb-diaphragm-low" : ""}`}
              >
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(242,237,228,.14)" strokeWidth="3" />
                <circle
                  className="nb-diaphragm-arc"
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="var(--nb-poison)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 15}
                  strokeDashoffset={(1 - frac) * 2 * Math.PI * 15}
                />
                <text
                  x="18"
                  y="21.5"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="900"
                  fill="var(--nb-bone)"
                >
                  {round.status === "open" ? Math.ceil(remainingSec) : "·"}
                </text>
              </svg>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    key={bankKey}
                    className="nb-bank-num nb-grain-in text-[1.15rem] font-black leading-none"
                    style={{ color: "var(--nb-bone)" }}
                  >
                    {fmtUsd(round.poolTotalCents)}
                  </span>
                  <span
                    className="text-[0.58rem] font-extrabold uppercase tracking-[0.22em]"
                    style={{ color: "rgba(242,237,228,.45)" }}
                  >
                    {round.status === "open" ? "банк живой" : round.status === "locked" ? "шов замер" : "resolved"}
                  </span>
                  {streak >= 2 && (
                    <span
                      className="ml-auto text-[0.62rem] font-black tracking-[0.14em]"
                      style={{ color: "var(--nb-poison)" }}
                    >
                      серия ×{streak}
                    </span>
                  )}
                </div>
                {/* шов банка: кость против крови */}
                <div className="mt-1.5 flex h-1 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{ width: `${realShare}%`, background: "var(--nb-bone)" }}
                  />
                  <div className="h-full flex-1" style={{ background: "var(--nb-blood)" }} />
                </div>
              </div>
            </div>

            {/* ошибка */}
            {error && (
              <p className="mt-2 text-[0.7rem] font-bold" style={{ color: "var(--nb-blood)" }}>
                {error}
              </p>
            )}

            {/* ---- idle: две крупные кнопки ---- */}
            {phase === "idle" && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  key={`lime-${flashLime}`}
                  onClick={() => pickSide("real")}
                  className={`nb-btn nb-btn-real rounded-xl px-3 py-3.5 text-[1rem] font-black tracking-[0.12em] ${
                    flashLime > 0 ? "nb-pulse-lime" : ""
                  }`}
                >
                  REAL
                </button>
                <button
                  onClick={() => pickSide("synth")}
                  className="nb-btn nb-btn-synth rounded-xl px-3 py-3.5 text-[1rem] font-black tracking-[0.12em]"
                >
                  SYNTH
                </button>
              </div>
            )}

            {/* ---- amount: пресеты суммы $1/$3/$5 ---- */}
            {phase === "amount" && chosenSide && (
              <div className="mt-2.5">
                <div className="flex items-center gap-1.5">
                  {BET.betPresetsCents.map((c) => (
                    <button
                      key={c}
                      onClick={() => chooseAmount(c)}
                      className="nb-btn nb-chip flex-1 rounded-xl border px-2 py-2.5 text-[0.85rem] font-black"
                      style={{
                        borderColor: "rgba(242,237,228,.22)",
                        color: "var(--nb-bone)",
                        background: "rgba(242,237,228,.05)",
                      }}
                    >
                      {fmtUsd(c)}
                    </button>
                  ))}
                  <button
                    onClick={() => setPhase("idle")}
                    aria-label="Back"
                    className="nb-btn rounded-xl px-3 py-2.5 text-[0.7rem] font-bold"
                    style={{ color: "rgba(242,237,228,.5)" }}
                  >
                    ←
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[0.62rem] font-bold" style={{ color: "rgba(242,237,228,.4)" }}>
                  на {chosenSide === "real" ? "REAL" : "SYNTH"} · крипто-инвойс 2328
                </p>
              </div>
            )}

            {/* ---- connect: ждём подключение кошелька (v5) ---- */}
            {phase === "connect" && (
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-2 text-[0.72rem] font-bold"
                  style={{ color: "rgba(242,237,228,.75)" }}
                >
                  {walletConnecting ? (
                    <>
                      <Wallet className="h-3.5 w-3.5 animate-pulse" />
                      подключаем кошелёк…
                    </>
                  ) : walletError ? (
                    walletError
                  ) : (
                    <>
                      <Wallet className="h-3.5 w-3.5" />
                      подключи кошелёк — ставка дожмётся сама
                    </>
                  )}
                </span>
                {walletError && (
                  <button
                    onClick={() => {
                      setPendingAmount(null);
                      setPhase("amount");
                    }}
                    className="nb-btn rounded-full px-3 py-1.5 text-[0.66rem] font-bold"
                    style={{ color: "rgba(242,237,228,.6)" }}
                  >
                    назад
                  </button>
                )}
              </div>
            )}

            {/* ---- pending: фишка в банке ---- */}
            {phase === "pending" && round.myBet && (
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span
                  key={`chip-${chipIn}`}
                  className="nb-chip-drop inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-black"
                  style={{
                    background: round.myBet.side === "real" ? "rgba(200,255,0,.14)" : "rgba(255,0,60,.16)",
                    color: round.myBet.side === "real" ? "var(--nb-poison)" : "#ffd9e2",
                    border: `1px solid ${round.myBet.side === "real" ? "rgba(200,255,0,.4)" : "rgba(255,0,60,.45)"}`,
                  }}
                >
                  {fmtUsd(round.myBet.amountCents)} · {round.myBet.side.toUpperCase()}
                </span>
                {payUrl ? (
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nb-btn rounded-full px-4 py-2 text-[0.7rem] font-black"
                    style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
                  >
                    оплатить инвойс
                  </a>
                ) : (
                  <span className="text-[0.68rem] font-bold" style={{ color: "rgba(242,237,228,.5)" }}>
                    {hasMyBet && round.myBet.status === "active" ? "ты в пуле" : "ждём шов…"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- joker-blink: серия 5+ ---------- */}
      {streak >= 5 && isActive && (
        <svg
          key={`joker-${streak}`}
          aria-hidden
          viewBox="0 0 24 24"
          className="nb-joker-blink pointer-events-none absolute right-4 top-16 z-40 h-10 w-10"
          fill="var(--nb-glitch-a)"
        >
          <path d="M12 2 C9 6 4 7 3 12 c1 4 5 6 9 10 4 -4 8 -6 9 -10 C20 7 15 6 12 2 Zm0 4 c1.6 2.2 4 3 4.6 6 -0.8 2.4 -2.6 3.6 -4.6 6 -2 -2.4 -3.8 -3.6 -4.6 -6 C8 9 10.4 8.2 12 6Z" />
        </svg>
      )}
    </>
  );
}
