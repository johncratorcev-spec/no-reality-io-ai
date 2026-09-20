"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { CRYO } from "@/lib/cryo/config";
import type { CryoMarketView, CryoSide } from "@/lib/cryo/core";
import { hookCryoAudioUnlock, playCryoSfx } from "@/lib/cryo/audio";
import {
  ensureCryoWallet,
  payUsdc,
  type CryoWallet,
} from "@/lib/cryo/wallet";
import { makeBetRef, writeCryoLocalBet } from "@/lib/cryo/local";

/* ================================================================
   Cryo-Stop (task 41, rev. 42) — оверлей рынка предсказаний.

   Пункт 1: ролик СМОТРИТСЯ CRYO.watchMs (5 секунд), только потом
            стоп-кадр + заморозка — ПЛАВНО (cooling-перецвет 1.1s,
            без резкого шока), после заморозки видео не играет.
   Пункт 4: после выбора исхода лёд ПЛАВИТСЯ, ролик доигрывается
            целиком, карточка уходит в PREDICTED (лейбл рисует
            VideoCard) и показывается как обычное видео.
   Пункт 2: ставка = прямой перевод $1 USDC на казначея через
            Phantom (demo — без on-chain, тот же UX).
   ================================================================ */

type Phase = "dormant" | "watching" | "cooling" | "market" | "melting";

/** окно рынка для расчёта заполнения кольца (конфиг-константа, 48ч) */
const WINDOW_MS = 48 * 3600 * 1000;

/** детерминированный «скрытый BPM» ролика: 84–123 из кода поста */
function hiddenBpm(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return 84 + (h % 40);
}

/** генерация морозных трещин: ветвящиеся ломаные из центра к краям */
interface Crack {
  d: string;
  delay: number;
  width: number;
}

function makeCracks(w: number, h: number, seed: number): Crack[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const cracks: Crack[] = [];
  const arms = 7;
  for (let i = 0; i < arms; i++) {
    const angle = (i / arms) * Math.PI * 2 + rnd() * 0.7;
    const cx = w / 2 + (rnd() - 0.5) * w * 0.2;
    const cy = h / 2 + (rnd() - 0.5) * h * 0.2;
    const reach = Math.max(w, h) * (0.55 + rnd() * 0.45);
    let x = cx;
    let y = cy;
    let a = angle;
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const segs = 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < segs; k++) {
      a += (rnd() - 0.5) * 0.9;
      const len = (reach / segs) * (0.6 + rnd() * 0.8);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      // дочерняя ветка (морозный узор)
      if (rnd() > 0.35 && k < segs - 1) {
        const ba = a + (rnd() > 0.5 ? 1 : -1) * (0.5 + rnd() * 0.6);
        const bl = len * (0.35 + rnd() * 0.5);
        d += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
        d += ` L ${(x + Math.cos(ba) * bl).toFixed(1)} ${(y + Math.sin(ba) * bl).toFixed(1)}`;
        d += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    cracks.push({ d, delay: 0.05 + rnd() * 0.3, width: 0.8 + rnd() * 1.6 });
  }
  return cracks;
}

/** тайл скан-шума (матрица сканирования) → data-URL */
function makeNoiseTile(): string {
  const size = 140;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = 255;
    img.data[i + 3] = Math.random() > 0.82 ? 26 + Math.random() * 40 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

/* ---------------- подкомпоненты ---------------- */

function RingTimer({
  remainingMs,
  boiling,
  accent,
  bpm,
}: {
  remainingMs: number;
  boiling: boolean;
  accent: string;
  bpm: number;
}) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(1, remainingMs / WINDOW_MS));
  const pulseDur = (60 / bpm).toFixed(3);
  return (
    <div
      className={`nr-cryo-ring ${boiling ? "nr-cryo-boil" : ""}`}
      style={{ ["--pulse" as string]: `${pulseDur}s` }}
      aria-hidden
    >
      <svg viewBox="0 0 128 128" className="nr-cryo-ring-svg">
        <defs>
          <linearGradient id={`cryo-liq-${accent.slice(1)}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2ea8ff" />
            <stop offset="55%" stopColor="#0f6bff" />
            <stop offset="100%" stopColor="#7ce7ff" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} className="nr-cryo-ring-track" />
        <circle
          cx="64"
          cy="64"
          r={R}
          className="nr-cryo-ring-liq"
          stroke={`url(#cryo-liq-${accent.slice(1)})`}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
        />
        <circle cx="64" cy="64" r={R} className="nr-cryo-ring-frost" />
      </svg>
      {boiling && (
        <span className="nr-cryo-bubbles">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} style={{ ["--i" as string]: i }} />
          ))}
        </span>
      )}
      <span className="nr-cryo-ring-core">
        <span className="nr-cryo-ring-time">{formatRemaining(remainingMs)}</span>
        <span className="nr-cryo-ring-cap">event horizon</span>
      </span>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}h`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function Crystal({
  side,
  label,
  odds,
  accent,
  dim,
  gold,
  flying,
  disabled,
  onPick,
}: {
  side: CryoSide;
  label: string;
  odds: number | null;
  accent: string;
  dim?: boolean;
  gold?: boolean;
  flying?: boolean;
  disabled?: boolean;
  onPick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-label={`Outcome ${label} — fixed $1.00 USDC at ×${odds ?? "—"}`}
      className={[
        "nr-cryo-crystal",
        side === "yes" ? "nr-cryo-crystal-yes" : "nr-cryo-crystal-no",
        dim ? "nr-cryo-crystal-dim" : "",
        gold ? "nr-cryo-crystal-gold" : "",
        flying ? "nr-cryo-flyout" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ["--accent" as string]: accent }}
    >
      <span className="nr-cryo-crystal-plasma" aria-hidden />
      <span className="nr-cryo-crystal-facets" aria-hidden />
      <span className="nr-cryo-crystal-label">{label}</span>
      <span className="nr-cryo-crystal-odds">×{odds ?? "—"}</span>
      <span className="nr-cryo-crystal-price">$1.00</span>
    </button>
  );
}

function CrowdBar({
  yesPool,
  noPool,
  accent,
  mySide,
}: {
  yesPool: number;
  noPool: number;
  accent: string;
  mySide: CryoSide | null;
}) {
  const total = yesPool + noPool;
  const yesShare = total > 0 ? yesPool / total : 0.5;
  return (
    <div className="nr-cryo-crowd">
      <span className="nr-cryo-crowd-sums">
        <b style={{ color: accent }}>${yesPool.toFixed(2)}</b>
        <i>the crowd</i>
        <b>${noPool.toFixed(2)}</b>
      </span>
      <span
        className={`nr-cryo-crowd-bar ${mySide ? "nr-cryo-crowd-my" : ""}`}
        role="img"
        aria-label={`Crowd distribution: yes $${yesPool.toFixed(2)} / no $${noPool.toFixed(2)}`}
      >
        <i
          className="nr-cryo-crowd-yes"
          style={{ width: `${yesShare * 100}%`, background: accent }}
        />
        <i className="nr-cryo-crowd-no" style={{ width: `${(1 - yesShare) * 100}%` }} />
        {mySide && (
          <i
            className="nr-cryo-crowd-marker"
            style={{ left: `${(mySide === "yes" ? yesShare / 2 : 1 - (1 - yesShare) / 2) * 100}%` }}
          />
        )}
      </span>
    </div>
  );
}

/** Изоляция внимания: страница позади поп-апа перестаёт существовать */
function ProtectedOverlay({
  side,
  label,
  accent,
  mode,
}: {
  side: CryoSide;
  label: string;
  accent: string;
  mode: "demo" | "usdc";
}) {
  return (
    <div className="nr-cryo-iso" role="dialog" aria-modal aria-label="Phantom protected popup">
      <div className="nr-cryo-iso-card">
        <span className="nr-cryo-iso-head">
          <i className="nr-cryo-iso-ghost" aria-hidden />
          <b>Phantom</b>
          <em>protected</em>
        </span>
        <span className="nr-cryo-iso-swap">
          <span className="nr-cryo-iso-amt">
            <small>you pay</small>
            <b>1.00 USDC</b>
          </span>
          <span className="nr-cryo-iso-arrow" aria-hidden>→</span>
          <span className="nr-cryo-iso-amt">
            <small>you get</small>
            <b style={{ color: accent }}>
              {side === "yes" ? "ДА" : label.toUpperCase()}
            </b>
          </span>
        </span>
        <span className="nr-cryo-iso-status">
          <i className="nr-cryo-iso-spin" aria-hidden />
          {mode === "usdc" ? "confirming USDC transfer…" : "confirming position…"}
        </span>
      </div>
    </div>
  );
}

/* ---------------- главный компонент ---------------- */

export interface CryoStopCardProps {
  market: CryoMarketView;
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  /** карточка заморожена (панель рынка) — VideoCard запрещает автоплей */
  onFrozen?: (frozen: boolean) => void;
  /** исход выбран и лёд растаял → PREDICTED, ролик доигрывает целиком */
  onPredicted: (side: CryoSide) => void;
  /** рынок истёк/решён без ставки → отпустить карточку как обычное видео */
  onRelease: () => void;
}

export default function CryoStopCard({
  market,
  videoRef,
  active,
  onFrozen,
  onPredicted,
  onRelease,
}: CryoStopCardProps) {
  const [phase, setPhase] = useState<Phase>("dormant");
  const [captured, setCaptured] = useState(false);
  const [noiseUrl, setNoiseUrl] = useState("");
  const [cracks, setCracks] = useState<Crack[]>([]);
  const [wallet, setWallet] = useState<CryoWallet | null>(null);
  const [bet, setBet] = useState<{ side: CryoSide; local: boolean } | null>(null);
  const [betting, setBetting] = useState<CryoSide | null>(null);
  const [popup, setPopup] = useState<CryoSide | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [flyout, setFlyout] = useState<CryoSide | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const frameRef = useRef<HTMLCanvasElement>(null);
  const watchedRef = useRef(0);
  const coolingRef = useRef(false);
  const releasedRef = useRef(false);

  const bpm = useMemo(() => hiddenBpm(market.postCode), [market.postCode]);
  const endsAtMs = useMemo(
    () => new Date(market.endsAt).getTime(),
    [market.endsAt]
  );
  const remainingMs = endsAtMs - now;
  const boiling = remainingMs <= CRYO.boilLeadSec * 1000 && remainingMs > 0;

  /* тикающие часы (countdown / кипение / истечение) */
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const clearVideoFilter = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.style.transition = "";
    v.style.filter = "";
  }, [videoRef]);

  /** плавное высвобождение: лёд тает → колбэк в VideoCard */
  const release = useCallback(
    (side: CryoSide | null) => {
      if (releasedRef.current) return;
      releasedRef.current = true;
      setPhase("melting");
      // thaw-рокот: мягкий, приглушённый
      void playCryoSfx("crack", { volume: 0.3, rate: 0.55 });
      setTimeout(() => {
        clearVideoFilter();
        onFrozen?.(false);
        if (side) onPredicted(side);
        else onRelease();
      }, CRYO.meltMs);
    },
    [clearVideoFilter, onFrozen, onPredicted, onRelease]
  );

  /* активация вниманием: dormant → watching (ролик играет, VideoCard его
     запускает) — заморозка наступит ТОЛЬКО после CRYO.watchMs просмотра */
  useEffect(() => {
    if (!active || phase !== "dormant") return;
    hookCryoAudioUnlock();
    setPhase("watching");
  }, [active, phase]);

  /* просмотр: копим реальное время проигрывания (пролистал — пауза,
     прогресс заморожен). Каждые 200мс, пока видео реально играет. */
  useEffect(() => {
    if (phase !== "watching") return;
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || !active) return;
      watchedRef.current += 200;
      if (watchedRef.current >= CRYO.watchMs && !coolingRef.current) {
        coolingRef.current = true;
        setPhase("cooling");
      }
    }, 200);
    return () => clearInterval(iv);
  }, [phase, active, videoRef]);

  /* плавная заморозка (пункт 1): охлаждение цвета → стоп-кадр → трещины */
  useEffect(() => {
    if (phase !== "cooling") return;
    const v = videoRef.current;
    if (v) {
      // мягкий переход цвета: transition вместо резкого шока
      v.style.transition = `filter ${CRYO.coolMs}ms ease`;
      v.style.filter =
        "saturate(0.35) brightness(0.88) contrast(1.1) hue-rotate(-14deg)";
    }
    const freezeT = setTimeout(() => {
      // стоп-кадр: видео больше НЕ играет до выбора исхода
      try {
        v?.pause();
      } catch {
        /* игнорируем */
      }
      // захват кадра (canvas-копия пиксельного буфера)
      const c = frameRef.current;
      if (v && c && v.videoWidth && v.readyState >= 2) {
        try {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext("2d");
          ctx?.drawImage(v, 0, 0);
          setCaptured(true);
        } catch {
          /* fallback: frost-слой без захвата */
        }
      }
      const seed =
        (Date.now() ^
          market.postCode
            .split("")
            .reduce((a, ch) => a + ch.charCodeAt(0), 0)) >>>
        0;
      setCracks(makeCracks(1280, 720, seed));
      setNoiseUrl(makeNoiseTile());
      void playCryoSfx("scan", { volume: 0.9 });
      setTimeout(() => {
        void playCryoSfx("crack", { volume: 0.85 });
      }, CRYO.crackDelayMs);
      setPhase("market");
      onFrozen?.(true);
    }, CRYO.coolMs);
    return () => clearTimeout(freezeT);
  }, [phase, videoRef, market.postCode, onFrozen]);

  /* истечение рынка прямо в оверлее: таем и отпускаем карточку */
  useEffect(() => {
    if (
      remainingMs <= 0 &&
      market.status === "live" &&
      (phase === "watching" || phase === "cooling" || phase === "market") &&
      !bet
    ) {
      void playCryoSfx("click", { volume: 0.8 });
      release(null);
    }
  }, [remainingMs, market.status, phase, bet, release]);

  /* вердикт оракула пришёл по поллингу, исход ещё не выбран → отпускаем */
  useEffect(() => {
    if (
      market.status === "resolved" &&
      !bet &&
      (phase === "watching" || phase === "cooling" || phase === "market")
    ) {
      release(null);
    }
  }, [market.status, bet, phase, release]);

  /* Block 5: one-tap — выбор исхода → USDC → фиксация → плавление */
  const pick = useCallback(
    async (side: CryoSide) => {
      if (phase !== "market" || betting || bet) return;
      setBetting(side);
      setPayError(null);
      setPopup(side);

      const w = await ensureCryoWallet();
      setWallet(w);

      const betRef = makeBetRef();
      const pay = await payUsdc({
        exchange: market.exchange,
        usdcMint: CRYO.usdcMint,
        treasury: CRYO.treasury,
        amountUsdc: CRYO.betAmountUsdc,
        betRef,
      });

      if (pay.error) {
        // платёж не состоялся — позицию НЕ фиксируем, рынок остаётся открыт
        setPopup(null);
        setBetting(null);
        setPayError(
          market.exchange === "usdc"
            ? "payment cancelled — USDC not sent"
            : pay.error
        );
        return;
      }

      let fixed = false;
      let localOnly = false;
      let failMsg: string | null = null;
      try {
        const r = await fetch("/api/cryo/bet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            postCode: market.postCode,
            side,
            wallet: w.address,
            mode: pay.mode,
            txSig: pay.txSig,
            betRef,
          }),
        });
        if (r.ok) fixed = true;
        else if (r.status === 503) localOnly = true;
        else if (r.status === 409) fixed = true; // позиция уже есть — показываем её
        else {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          failMsg = d.error ?? "bet rejected";
        }
      } catch {
        localOnly = true; // сеть недоступна — локальная фиксация
      }

      setPopup(null);
      setBetting(null);

      if (failMsg) {
        setPayError(failMsg);
        return;
      }

      if (fixed || localOnly) {
        writeCryoLocalBet(market.postCode, {
          side,
          wallet: w.address,
          local: localOnly,
          ts: Date.now(),
        });
        setBet({ side, local: localOnly });
        setFlyout(side); // кристалл отрывается и улетает за экран
        setTimeout(() => release(side), 720);
      }
    },
    [phase, betting, bet, market, release]
  );

  if (!active && phase === "dormant") return null;

  const mySide = bet?.side ?? null;
  const showPanel = phase === "market";
  const melting = phase === "melting";

  return (
    <div
      className={[
        "nr-cryo-root",
        phase === "market" || phase === "melting" ? "nr-cryo-on" : "",
        phase === "watching" || phase === "cooling" ? "nr-cryo-watch" : "",
        melting ? "nr-cryo-melt-out" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ["--accent" as string]: market.accent }}
      aria-label="Cryo-stop prediction market"
    >
      {/* ── watching/cooling: ролик играется, только тихий маячок рынка ── */}
      {(phase === "watching" || phase === "cooling") && (
        <span className="nr-cryo-live-chip" aria-hidden>
          ❄ prediction live
        </span>
      )}

      {/* ── циан-вуаль плавного охлаждения (с cooling, не во время просмотра) ── */}
      {phase !== "watching" && <div className="nr-cryo-frost" aria-hidden />}

      {/* ── захваченный стоп-кадр — видео скрыто под статичной картинкой ── */}
      <canvas
        ref={frameRef}
        aria-hidden
        className={`nr-cryo-frame ${captured ? "nr-cryo-frame-on" : "nr-cryo-frame-off"}`}
      />

      {phase === "market" && (
        <>
          <div
            className="nr-cryo-noise"
            aria-hidden
            style={noiseUrl ? { backgroundImage: `url(${noiseUrl})` } : undefined}
          />
          <svg
            className="nr-cryo-cracks"
            viewBox="0 0 1280 720"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            {cracks.map((c, i) => (
              <path
                key={i}
                d={c.d}
                pathLength={1}
                strokeWidth={c.width}
                style={{ ["--cd" as string]: `${c.delay}s` }}
              />
            ))}
          </svg>
          <div className="nr-cryo-glow" aria-hidden />
        </>
      )}

      {/* ── панель рынка (Block 4) ── */}
      {showPanel && (
        <div className="nr-cryo-panel nr-cryo-panel-up">
          <div className="nr-cryo-panel-top">
            <RingTimer
              remainingMs={remainingMs}
              boiling={boiling}
              accent={market.accent}
              bpm={bpm}
            />
            <div className="nr-cryo-qwrap">
              <p className="nr-cryo-q" aria-label={market.question}>
                {market.question.split("").map((ch, i) => (
                  <span
                    key={i}
                    style={{ ["--ci" as string]: `${0.05 + i * 0.05}s` }}
                    className="nr-cryo-ch"
                  >
                    {ch === " " ? "\u00A0" : ch}
                  </span>
                ))}
              </p>
              {payError && <p className="nr-cryo-payerr">{payError}</p>}
            </div>
          </div>

          <div className="nr-cryo-crystals">
            <Crystal
              side="yes"
              label={market.labelYes}
              odds={market.oddsYes}
              accent={market.accent}
              disabled={Boolean(betting) || Boolean(bet)}
              dim={Boolean(mySide && mySide !== "yes")}
              flying={flyout === "yes"}
              onPick={() => void pick("yes")}
            />
            <Crystal
              side="no"
              label={market.labelNo}
              odds={market.oddsNo}
              accent={market.accent}
              disabled={Boolean(betting) || Boolean(bet)}
              dim={Boolean(mySide && mySide !== "no")}
              flying={flyout === "no"}
              onPick={() => void pick("no")}
            />
          </div>

          <CrowdBar
            yesPool={market.yesPool}
            noPool={market.noPool}
            accent={market.accent}
            mySide={mySide}
          />
        </div>
      )}

      {/* Block 5: изоляция внимания на время поп-апа кошелька */}
      {popup && (
        <ProtectedOverlay
          side={popup}
          label={popup === "yes" ? market.labelYes : market.labelNo}
          accent={market.accent}
          mode={market.exchange}
        />
      )}
    </div>
  );
}
