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
import { cryoOdds, normalizeUsdc } from "@/lib/cryo/odds";
import type { CryoMarketView, CryoSide } from "@/lib/cryo/core";
import { hookCryoAudioUnlock, playCryoSfx } from "@/lib/cryo/audio";
import {
  ensureCryoWallet,
  payUsdc,
  type CryoWallet,
} from "@/lib/cryo/wallet";
import { makeBetRef, writeCryoLocalBet } from "@/lib/cryo/local";

/* ================================================================
   Cryo-Stop (task 41, rev. 43) — the prediction overlay.

   Point 1: the clip plays for CRYO.watchMs (5s) BEFORE the freeze;
            the stop-frame arrives SMOOTHLY (1.1s cooling tint) and
            the video stays fully paused inside the market.
   Point 4: once the outcome is picked the ice MELTS, the clip plays
            out in full and the card returns to regular video with a
            PREDICTED label (rendered by VideoCard).
   Point 2: a bet is a direct USDC transfer to the treasury via
            Phantom (demo mode: same UX, no on-chain payment).
   Task 43: minimalist market panel + stake of ANY USDC amount —
            preset chips, custom input, odds and "win ≈" recalc live.
   ================================================================ */

type Phase = "dormant" | "watching" | "cooling" | "market" | "melting";

/** display window of the horizon bar (config-era constant, 48h) */
const WINDOW_MS = 48 * 3600 * 1000;

/** deterministic "hidden BPM" of a clip: 84–123 derived from the post code */
function hiddenBpm(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return 84 + (h % 40);
}

/** frost cracks: branching polylines growing from the center outwards */
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
      // child branch (frost pattern)
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

/** scan-noise tile (matrix scan) → data-URL */
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

/* ---------------- subcomponents ---------------- */

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}h`;
  return `${m}:${String(sec).padStart(2, "0")}`;
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

/** attention isolation: the page behind the wallet pop-up stops existing */
function ProtectedOverlay({
  label,
  accent,
  mode,
  amount,
}: {
  label: string;
  accent: string;
  mode: "demo" | "usdc";
  amount: string;
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
            <b>{amount} USDC</b>
          </span>
          <span className="nr-cryo-iso-arrow" aria-hidden>→</span>
          <span className="nr-cryo-iso-amt">
            <small>you get</small>
            <b style={{ color: accent }}>{label.toUpperCase()}</b>
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

/* ---------------- the main component ---------------- */

export interface CryoStopCardProps {
  market: CryoMarketView;
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  /** the card is frozen (market panel) — VideoCard forbids autoplay */
  onFrozen?: (frozen: boolean) => void;
  /** outcome picked and ice melted → PREDICTED, the clip plays out */
  onPredicted: (side: CryoSide) => void;
  /** market expired/resolved without a bet → release as a regular video */
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
  const [popup, setPopup] = useState<{ side: CryoSide; amount: string } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /* task 43: stake of any size — preset chips + custom input */
  const [amount, setAmount] = useState<string>(CRYO.betAmountUsdc);
  const [amountText, setAmountText] = useState<string>("");

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

  /* live odds for the SELECTED stake (pari-mutuel, fee-aware) */
  const totalPool = market.yesPool + market.noPool;
  const stakeNum = parseFloat(amount) || 0;
  const oddsYes = cryoOdds(totalPool, market.yesPool, stakeNum, CRYO.feePct);
  const oddsNo = cryoOdds(totalPool, market.noPool, stakeNum, CRYO.feePct);

  /* selected preset (for chip highlight); null when custom amount active */
  const activePreset = CRYO.betPresetsUsdc.includes(amount)
    ? amount
    : null;

  const applyCustom = (raw: string) => {
    setAmountText(raw);
    const norm = normalizeUsdc(raw);
    if (norm && parseFloat(norm) >= parseFloat(CRYO.minBetUsdc)) {
      setAmount(norm);
    }
  };

  /* ticking clock (countdown / boiling / expiry) */
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

  /** smooth release: ice melts → callback into VideoCard */
  const release = useCallback(
    (side: CryoSide | null) => {
      if (releasedRef.current) return;
      releasedRef.current = true;
      setPhase("melting");
      // thaw rumble: soft, muted
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

  /* attention activation: dormant → watching (the clip plays, VideoCard
     starts it) — the freeze lands ONLY after CRYO.watchMs of watching.
     rAF: фазовые переходы не синхронны с телом эффекта (требование React) */
  useEffect(() => {
    if (!active || phase !== "dormant") return;
    hookCryoAudioUnlock();
    const raf = requestAnimationFrame(() => setPhase("watching"));
    return () => cancelAnimationFrame(raf);
  }, [active, phase]);

  /* watching: accumulate REAL playback time (scrolled away → paused,
     progress frozen). Ticked every 200ms while the video actually plays. */
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

  /* smooth freeze (point 1): color cooling → stop-frame → cracks */
  useEffect(() => {
    if (phase !== "cooling") return;
    const v = videoRef.current;
    if (v) {
      // soft color transition: CSS transition instead of a hard shock
      v.style.transition = `filter ${CRYO.coolMs}ms ease`;
      v.style.filter =
        "saturate(0.35) brightness(0.88) contrast(1.1) hue-rotate(-14deg)";
    }
    const freezeT = setTimeout(() => {
      // stop-frame: the video does NOT play until the outcome is picked
      try {
        v?.pause();
      } catch {
        /* ignored */
      }
      // frame capture (canvas copy of the pixel buffer)
      const c = frameRef.current;
      if (v && c && v.videoWidth && v.readyState >= 2) {
        try {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext("2d");
          ctx?.drawImage(v, 0, 0);
          setCaptured(true);
        } catch {
          /* fallback: frost layer without capture */
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

  /* market expiring inside the overlay: melt and release the card.
     Реакция на приход пропсов (время/статус из поллинга) — setState здесь
     намеренный, синхронизация с внешним источником данных. */
  useEffect(() => {
    if (
      remainingMs <= 0 &&
      market.status === "live" &&
      (phase === "watching" || phase === "cooling" || phase === "market") &&
      !bet
    ) {
      void playCryoSfx("click", { volume: 0.8 });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      release(null);
    }
  }, [remainingMs, market.status, phase, bet, release]);

  /* oracle verdict arrived via polling, outcome not picked yet → release.
     Аналогично: реакция на внешние данные (поллинг рынков). */
  useEffect(() => {
    if (
      market.status === "resolved" &&
      !bet &&
      (phase === "watching" || phase === "cooling" || phase === "market")
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      release(null);
    }
  }, [market.status, bet, phase, release]);

  /* one-tap: outcome → USDC (staked amount) → fix → melt */
  const pick = useCallback(
    async (side: CryoSide) => {
      if (phase !== "market" || betting || bet) return;
      const stake = normalizeUsdc(amount);
      if (!stake || parseFloat(stake) < parseFloat(CRYO.minBetUsdc)) {
        setPayError(
          `min stake is $${CRYO.minBetUsdc} USDC · max $${CRYO.maxBetUsdc}`
        );
        return;
      }
      setBetting(side);
      setPayError(null);
      setPopup({ side, amount: stake });

      const w = await ensureCryoWallet();
      setWallet(w);

      const betRef = makeBetRef();
      const pay = await payUsdc({
        exchange: market.exchange,
        usdcMint: CRYO.usdcMint,
        treasury: CRYO.treasury,
        amountUsdc: stake,
        betRef,
      });

      if (pay.error) {
        // payment did not happen — do NOT fix the position, market stays open
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
            amount: stake,
            wallet: w.address,
            mode: pay.mode,
            txSig: pay.txSig,
            betRef,
          }),
        });
        if (r.ok) fixed = true;
        else if (r.status === 503) localOnly = true;
        else if (r.status === 409) fixed = true; // position exists — show it
        else {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          failMsg = d.error ?? "bet rejected";
        }
      } catch {
        localOnly = true; // network down — local fix
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
        setTimeout(() => release(side), 620);
      }
    },
    [phase, betting, bet, market, release, amount]
  );

  if (!active && phase === "dormant") return null;

  const mySide = bet?.side ?? null;
  const showPanel = phase === "market";
  const melting = phase === "melting";
  const horizonPct = Math.max(0, Math.min(1, remainingMs / WINDOW_MS)) * 100;

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
      style={{ ["--accent" as string]: market.accent, ["--bpm" as string]: `${(60 / bpm).toFixed(3)}s` }}
      aria-label="Cryo-stop prediction market"
    >
      {/* ── watching/cooling: the clip plays, only a quiet market beacon ── */}
      {(phase === "watching" || phase === "cooling") && (
        <span className="nr-cryo-live-chip" aria-hidden>
          ❄ prediction live
        </span>
      )}

      {/* ── cyan veil of smooth cooling (from cooling on, not while watching) ── */}
      {phase !== "watching" && <div className="nr-cryo-frost" aria-hidden />}

      {/* ── captured stop-frame — the video hides under a still image ── */}
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

      {/* ── the market panel (minimal, task 43) ── */}
      {showPanel && (
        <div className="nr-cryo-panel nr-cryo-panel-up" role="dialog" aria-label="Prediction market">
          {/* event horizon: thin liquid line draining with the countdown */}
          <span
            className={`nr-cryo-horizon ${boiling ? "nr-cryo-horizon-boil" : ""}`}
            style={{ width: `${horizonPct}%` }}
            aria-hidden
          />

          <div className="nr-cryo-head">
            <span className="nr-cryo-live" aria-hidden>
              <i /> prediction live
            </span>
            <span
              className={`nr-cryo-timer ${boiling ? "nr-cryo-timer-boil" : ""}`}
              title={`market window · pulse ${bpm}bpm`}
            >
              {formatRemaining(remainingMs)}
            </span>
          </div>

          <p className="nr-cryo-q">{market.question}</p>

          {/* stake: preset chips + custom amount, odds recalc live */}
          <div className="nr-cryo-stake">
            <span className="nr-cryo-stake-cap" id="cryo-stake-label">
              stake
            </span>
            <div
              className="nr-cryo-chips"
              role="radiogroup"
              aria-labelledby="cryo-stake-label"
            >
              {CRYO.betPresetsUsdc.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={activePreset === p}
                  disabled={Boolean(betting) || Boolean(bet)}
                  onClick={() => {
                    setAmount(p);
                    setAmountText("");
                  }}
                  className={`nr-cryo-chip ${activePreset === p ? "nr-cryo-chip-on" : ""}`}
                >
                  ${p}
                </button>
              ))}
              <span className={`nr-cryo-custom ${amountText ? "nr-cryo-custom-on" : ""}`}>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="custom"
                  aria-label="Custom stake in USDC"
                  value={amountText}
                  disabled={Boolean(betting) || Boolean(bet)}
                  onChange={(e) => applyCustom(e.target.value)}
                  maxLength={9}
                />
                <em>USDC</em>
              </span>
            </div>
          </div>

          {/* two big outcomes — one tap fixes the position */}
          <div className="nr-cryo-actions">
            {(["yes", "no"] as const).map((side) => {
              const label = side === "yes" ? market.labelYes : market.labelNo;
              const odds = side === "yes" ? oddsYes : oddsNo;
              return (
                <button
                  key={side}
                  type="button"
                  disabled={Boolean(betting) || Boolean(bet)}
                  onClick={() => void pick(side)}
                  aria-label={`Outcome ${label} — stake ${amount} USDC at ×${odds}`}
                  className={[
                    "nr-cryo-action",
                    side === "yes" ? "nr-cryo-action-yes" : "nr-cryo-action-no",
                    betting === side ? "nr-cryo-action-busy" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <b>{label}</b>
                  <span className="nr-cryo-action-odds">×{odds.toFixed(2)}</span>
                  <span className="nr-cryo-action-note">
                    win ≈ ${(stakeNum * odds).toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>

          <CrowdBar
            yesPool={market.yesPool}
            noPool={market.noPool}
            accent={market.accent}
            mySide={mySide}
          />

          {payError && <p className="nr-cryo-payerr">{payError}</p>}
        </div>
      )}

      {/* attention isolation while the wallet pop-up is up */}
      {popup && (
        <ProtectedOverlay
          label={popup.side === "yes" ? market.labelYes : market.labelNo}
          accent={market.accent}
          mode={market.exchange}
          amount={popup.amount}
        />
      )}
    </div>
  );
}
