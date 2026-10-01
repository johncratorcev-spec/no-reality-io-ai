"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Gift, Lock } from "lucide-react";
import { BET, fmtUsd } from "@/lib/bet/config";
import { fmtBalance, DAILY_CHALLENGE_BONUS_CENTS } from "@/lib/econ";
import { withRef } from "@/lib/shareRef";
import { track } from "@/lib/bet/trackClient";
import { useAccount, type AccountView } from "@/hooks/use-account";
import type { RoundView } from "@/lib/bet/roundView";
import PredictModal from "./PredictModal";
import AuthGateOverlay from "./AuthGateOverlay";
import { useLang } from "@/lib/i18n";
import ShareSeam from "./ShareSeam";
import ShareRow, { buildShareText } from "./ShareRow";

/**
 * BetPanel v5 — панель предикшен-ленты (REAL / SYNTH + банк + таймер).
 *
 * Поток (v6, воронка предикшенов): свайп → клип активен → GET /api/round
 * (лениво открывает раунд) → тап REAL/SYNTH → PREDICT-МОДАЛКА → сумма $1/$3/$5
 * → ставка с ВНУТРЕННЕГО БАЛАНСА мгновенно («ТЫ В ПУЛЕ») → поллинг
 * /api/round/:id каждые ~1.5с → резолв → РЕЗУЛЬТАТ-КАРТА (вердикт + сумма +
 * deep link + «поделиться результатом» + «следующий»).
 *
 * Порог входа = 0: аккаунт создаётся сам (cookie nr_uid + welcome-бонус),
 * ни кошелька, ни форм. Google-вход — опционален (NR PASS/leaderboard).
 * Не хватает баланса → модалка сама предлагает крипто-пополнение (2328.io)
 * и после вебхука дожимает ставку.
 *
 * Аналитика воронки: prediction_view / funnel_side_pick / predict_modal_open /
 * funnel_confirm / funnel_insufficient / topup_open / bet_placed (сервер) /
 * share_result.
 */

type Side = "real" | "synth";

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
  const { t, lang } = useLang();
  const { account, authed, refresh: refreshAccount, setAccount, claimDaily } = useAccount();

  const [round, setRound] = useState<RoundView | null>(null);
  const [phase, setPhase] = useState<"idle" | "pending">("idle");
  const [chosenSide, setChosenSide] = useState<Side | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
  /* v10: auth-гейт для гостей + спарклайн банка для инфографики */
  const [authGate, setAuthGate] = useState<Side | null>(null);
  const [spark, setSpark] = useState<number[]>([]);

  const skewRef = useRef(0);
  const settledRef = useRef(false);
  const lastModeRef = useRef<string | null>(null);
  const clipRef = useRef(clipCode);
  clipRef.current = clipCode;

  /* ---- клип стал активным: открыть/поднять раунд ---- */
  useEffect(() => {
    if (!isActive) return;
    setActivations((a) => a + 1);
    setStreak(readStreak());
    settledRef.current = false;
    setError("");
    setModalOpen(false);
    setChosenSide(null);
    setPayUrl(null);
    setPhase("idle");
    setSpark([]);
    setAuthGate(null);
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
          setSpark([d.round.poolTotalCents]);
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
    /* v8: награда за просмотр ленты — каждые N уникальных клипов за день
       дают монеты; сервер сам дедуплицирует и капсит (fire-and-forget) */
    void (async () => {
      try {
        const r = await fetch("/api/reward/watch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clipCode }),
        });
        if (!r.ok) return;
        const d = (await r.json()) as { account?: AccountView };
        if (d.account) setAccount(d.account);
      } catch {
        /* награда не критична */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isActive, clipCode, setAccount]);

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
    /* v6: выигрыш balance-ставки упал на внутренний баланс — обновляем */
    void refreshAccount();
  }, [refreshAccount]);

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
              if (d.round.poolTotalCents !== prevTotal) {
                setBankKey((k) => k + 1);
                setSpark((s) => [...s.slice(-47), d.round!.poolTotalCents]);
              }
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

  /* ---- v6: ставка из модалки предикта прошла ---- */
  const onPlaced = useCallback(
    (d: {
      bet_id?: string;
      status?: string;
      mode?: string;
      pay_url?: string | null;
      round?: RoundView | null;
      account?: AccountView;
    }) => {
      setError("");
      if (d.round) {
        setRound(d.round);
        setBankKey((k) => k + 1);
        setSpark((s) => [...s.slice(-47), d.round!.poolTotalCents]);
      }
      if (d.account) setAccount(d.account);
      lastModeRef.current = "balance";
      if (d.status === "pending" && d.pay_url) {
        setPayUrl(d.pay_url);
      }
      setModalOpen(false);
      setChosenSide(null);
      setPhase("pending");
      /* мгновенный фидбек «ТЫ В ПУЛЕ» — balance-ставка в пуле сразу */
      if (d.status === "active") {
        setChipIn((c) => c + 1);
        setInPool((v) => v + 1);
        setTimeout(() => setInPool(0), 1700);
      }
    },
    [setAccount]
  );

  /** тап REAL/SYNTH: v10 — гость получает премиум auth-гейт, игрок — модалку */
  const pickSide = (side: Side) => {
    if (!round) return;
    setError("");
    setChosenSide(side);
    if (side === "real") setFlashLime((f) => f + 1);
    else setFlashBlood((f) => f + 1);
    if (!authed) {
      setAuthGate(side);
      track("funnel_auth_gate", clipCode, { side });
      return;
    }
    setModalOpen(true);
    track("funnel_side_pick", clipCode, { side });
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setChosenSide(null);
  }, []);
  const again = () => {
    /* новый шов: перезапрашиваем раунд (старый уже resolved) */
    settledRef.current = false;
    setChosenSide(null);
    setModalOpen(false);
    setPayUrl(null);
    setPhase("idle");
    setSpark([]);
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
            setSpark([d.round.poolTotalCents]);
          }
        }
      } catch {
        /* тишина */
      }
    })();
  };

  /* ---- Result / Share Card (v5→v13): вердикт + сумма + 6 целей шеринга ---- */
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : withRef(`${window.location.origin}/v/${clipRef.current}`);
  const shareText = buildShareText(
    lang,
    round?.myResult === "won",
    round?.resolvedAs === "real",
    Math.round(
      (round?.myResult === "won" ? round?.myPayoutCents ?? 0 : round?.myBet?.amountCents ?? 0)
    )
  );
  const trackShare = (target: string) =>
    track("share_result", clipRef.current, {
      won: round?.myResult === "won",
      as: round?.resolvedAs,
      target,
    });

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
  /* v10 инфографика: пари-мьютюэль шансы = банк / пул стороны.
     Ставка $1 на сторону с ×2.33 вернёт ~$2.33 при её победе (до рейка) */
  const realOdds =
    round && round.poolRealCents > 0 ? round.poolTotalCents / round.poolRealCents : null;
  const synthOdds =
    round && round.poolSynthCents > 0 ? round.poolTotalCents / round.poolSynthCents : null;
  const oddsLabel = (o: number | null) => (o ? `×${o >= 10 ? o.toFixed(0) : o.toFixed(2)}` : "—");

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
            {t.bet.inPool} · {fmtUsd(round?.myBet?.amountCents ?? 0)}{" "}
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
                {result.as === "real" ? t.bet.wasReal : t.bet.wasSynth}
              </p>

              <div
                className="mx-auto mt-4 h-px w-16"
                style={{ background: "rgba(242,237,228,.18)" }}
              />

              {result.mine === "won" && (
                <p className="mt-4 text-[1.05rem] font-black" style={{ color: "var(--nb-poison)" }}>
                  {t.bet.eyeWorked}{fmtUsd(result.payout)}
                  {lastModeRef.current === "balance" ? t.bet.onBalance : ""}
                </p>
              )}
              {result.mine === "lost" && (
                <p className="mt-4 text-[0.95rem] font-extrabold" style={{ color: "rgba(242,237,228,.72)" }}>
                  {fmtUsd(round?.myBet?.amountCents ?? 0)}{t.bet.wentToBank}
                </p>
              )}
              {!result.mine && (
                <p className="mt-4 text-[0.85rem] font-bold" style={{ color: "rgba(242,237,228,.55)" }}>
                  {t.bet.notBet}
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
                  {t.bet.streak}{streak}
                </p>
              )}
              {round?.challenge && !result.mine && (
                <p className="mt-3 inline-flex items-center rounded-full border border-[rgba(255,184,0,0.4)] bg-[rgba(255,184,0,0.08)] px-3 py-1 text-[0.66rem] font-black tracking-[0.1em] text-[#ffb800]">
                  {t.daily.badge} · +{DAILY_CHALLENGE_BONUS_CENTS} EYE
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

            {/* CTA (v13): следующий + 6 целей шеринга + ещё шов */}
            <div className="flex w-full flex-col items-stretch gap-2">
              {onNext && (
                <button
                  onClick={onNext}
                  className="nb-btn w-full rounded-full px-5 py-3 text-[0.85rem] font-black"
                  style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
                >
                  {t.bet.next}
                </button>
              )}
              <ShareRow
                url={shareUrl}
                text={shareText}
                onTrack={(target) => trackShare(target)}
              />
              <button
                onClick={again}
                className="nb-btn nb-btn-real w-full rounded-full px-4 py-2.5 text-[0.74rem] font-bold"
              >
                {t.bet.moreSeams}
              </button>
              <div className="flex items-center justify-center gap-3">
                <ShareSeam mode="invite" className="nb-btn nb-btn-real rounded-full px-4 py-2 text-[0.68rem] font-bold" />
                <a
                  href="/pnl"
                  className="text-[0.64rem] font-bold underline decoration-dotted underline-offset-4"
                  style={{ color: "rgba(242,237,228,.5)" }}
                >
                  {t.bet.cashoutPnl}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- ПАНЕЛЬ СТАВКИ (v10: живая инфографика) ---------- */}
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
                  <span className="flex items-baseline gap-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.22em]" style={{ color: "rgba(242,237,228,.45)" }}>
                    {round.status === "open" && <span aria-hidden className="nb-live-dot" />}
                    {round.status === "open" ? t.bet.bankLive : round.status === "locked" ? t.bet.bankFrozen : "resolved"}
                  </span>
                  {round.challenge && (
                    <span
                      className="ml-1 inline-flex items-center rounded-full border border-[rgba(255,184,0,0.45)] bg-[rgba(255,184,0,0.1)] px-2 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.12em] text-[#ffb800]"
                      title={t.daily.bonus.replace("{N}", String(DAILY_CHALLENGE_BONUS_CENTS))}
                    >
                      ★ {t.daily.badge} +{DAILY_CHALLENGE_BONUS_CENTS}
                    </span>
                  )}
                  {streak >= 2 && (
                    <span
                      className="ml-auto text-[0.62rem] font-black tracking-[0.14em]"
                      style={{ color: "var(--nb-poison)" }}
                    >
                      {t.bet.streak}{streak}
                    </span>
                  )}
                </div>
                {/* шов банка: кость против крови + проценты сторон */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="w-7 shrink-0 text-right text-[0.56rem] font-black tabular-nums"
                    style={{ color: "rgba(242,237,228,.8)" }}
                  >
                    {realShare}%
                  </span>
                  <div
                    className="relative h-1.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: "rgba(255,0,60,.45)" }}
                    role="img"
                    aria-label={`real ${realShare}% / synth ${100 - realShare}%`}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${realShare}%`,
                        background: "linear-gradient(90deg, var(--nb-bone), rgba(242,237,228,.72))",
                        boxShadow: "0 0 10px rgba(242,237,228,.35)",
                      }}
                    />
                  </div>
                  <span
                    className="w-7 shrink-0 text-[0.56rem] font-black tabular-nums"
                    style={{ color: "#ff5c7a" }}
                  >
                    {100 - realShare}%
                  </span>
                </div>
                {/* спарклайн банка: живой ритм притока (сессия клиента) */}
                {spark.length >= 2 && round.status === "open" && (() => {
                  const min = Math.min(...spark);
                  const max = Math.max(...spark);
                  const rng = max - min || 1;
                  const h = 14;
                  const pts = spark
                    .map(
                      (v, i) =>
                        `${(i / (spark.length - 1)) * 100},${h - 2 - ((v - min) / rng) * (h - 4)}`
                    )
                    .join(" ");
                  return (
                    <svg
                      viewBox={`0 0 100 ${h}`}
                      preserveAspectRatio="none"
                      aria-hidden
                      className="mt-1.5 h-3.5 w-full"
                      style={{ opacity: 0.85 }}
                    >
                      <polyline
                        points={pts}
                        fill="none"
                        stroke="rgba(0,240,255,.6)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* ошибка */}
            {error && (
              <p className="mt-2 text-[0.7rem] font-bold" style={{ color: "var(--nb-blood)" }}>
                {error}
              </p>
            )}

            {/* ---- v10: строка аккаунта — гость видит приглашение, игрок баланс ---- */}
            {phase === "idle" && !authed && (
              <button
                onClick={() => setAuthGate(chosenSide ?? "real")}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[0.72rem] font-black tracking-wide transition-colors"
                style={{
                  background: "rgba(242,237,228,.05)",
                  border: "1px dashed rgba(242,237,228,.28)",
                  color: "rgba(242,237,228,.85)",
                }}
              >
                <Lock className="h-3 w-3" aria-hidden />
                {t.bet.guestCta}
              </button>
            )}
            {phase === "idle" && authed && (
              <div className="mt-2.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-black"
                  style={{
                    background: "rgba(200,255,0,.1)",
                    color: "var(--nb-poison)",
                    border: "1px solid rgba(200,255,0,.28)",
                  }}
                >
                  <Coins className="h-3 w-3" />
                  {fmtBalance(account?.balanceCents ?? 0)}
                </span>
                {account?.isPass && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[0.56rem] font-black tracking-[0.16em]"
                    style={{ background: "rgba(242,237,228,.1)", color: "rgba(242,237,228,.75)" }}
                  >
                    PASS
                  </span>
                )}
                {account?.isPass && account.dailyAvailable && (
                  <button
                    onClick={() => void claimDaily()}
                    className="nb-btn inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.62rem] font-black"
                    style={{
                      background: "rgba(200,255,0,.12)",
                      color: "var(--nb-poison)",
                      border: "1px solid rgba(200,255,0,.3)",
                    }}
                  >
                    <Gift className="h-3 w-3" />
                    {t.bet.bonus}
                  </button>
                )}
              </div>
            )}

            {/* ---- idle: две крупные кнопки с живыми пари-мьютюэль шансами ---- */}
            {phase === "idle" && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  key={`lime-${flashLime}`}
                  onClick={() => pickSide("real")}
                  className={`nb-btn nb-btn-real rounded-xl px-3 py-2.5 ${
                    flashLime > 0 ? "nb-pulse-lime" : ""
                  }`}
                >
                  <span className="block text-[1rem] font-black leading-none tracking-[0.12em]">REAL</span>
                  <span
                    className="mt-1 block text-[0.56rem] font-extrabold uppercase tracking-[0.1em] tabular-nums"
                    style={{ color: "rgba(242,237,228,.55)" }}
                  >
                    {t.bet.pays} {oddsLabel(realOdds)}
                  </span>
                </button>
                <button
                  onClick={() => pickSide("synth")}
                  className="nb-btn nb-btn-synth rounded-xl px-3 py-2.5"
                >
                  <span className="block text-[1rem] font-black leading-none tracking-[0.12em]">SYNTH</span>
                  <span
                    className="mt-1 block text-[0.56rem] font-extrabold uppercase tracking-[0.1em] tabular-nums"
                    style={{ color: "rgba(255,217,226,.6)" }}
                  >
                    {t.bet.pays} {oddsLabel(synthOdds)}
                  </span>
                </button>
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
                    {t.bet.payInvoice}
                  </a>
                ) : (
                  <span className="text-[0.68rem] font-bold" style={{ color: "rgba(242,237,228,.5)" }}>
                    {hasMyBet && round.myBet.status === "active" ? t.bet.youInPool : t.bet.waitingSeam}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- v6: predict-модалка — последняя ступень воронки (только authed) ---------- */}
      {modalOpen && round && authed && (
        <PredictModal
          roundId={round.id}
          clipCode={clipCode}
          side={chosenSide}
          account={account}
          onClose={closeModal}
          onPlaced={onPlaced}
          onAccountUpdate={setAccount}
        />
      )}

      {/* ---------- v10: премиум auth-гейт для гостей ---------- */}
      {authGate && round && !result && (
        <AuthGateOverlay
          clipCode={clipCode}
          side={authGate}
          onClose={() => setAuthGate(null)}
        />
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
