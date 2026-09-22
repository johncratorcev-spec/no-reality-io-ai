"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CryoMarketView } from "@/lib/cryo/core";

/* ================================================================
   Block 8: пульт управления криокамерами биолаборатории.
   Тёмный терминал, монохромные сетки данных, холодный неон.

   Верdict куратора: hold-to-confirm 1.5s (исключает случайное закрытие
   рынка при пролистывании) → подпись администратора (второй фактор —
   оракул-ключ; слот под аппаратный подписант/YubiKey).
   ================================================================ */

interface PostStatic {
  code: string;
  videoUrl: string;
  title: string;
  author: string;
}

const HOLD_MS = 1500;

export default function OracleConsole({ posts }: { posts: PostStatic[] }) {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<CryoMarketView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // task 44: result — ключ любой опции рынка ("yes"/"no"/нарративный)
  const [signing, setSigning] = useState<{ postCode: string; result: string } | null>(null);
  const [holdKey, setHoldKey] = useState<string | null>(null);
  const holdRaf = useRef<number>(0);
  const holdStart = useRef<number>(0);
  const [holdPct, setHoldPct] = useState(0);

  const postByCode = new Map(posts.map((p) => [p.code, p]));

  const loadMarkets = useCallback(async () => {
    try {
      const r = await fetch("/api/cryo/markets", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { markets?: CryoMarketView[] };
      if (d.markets) setMarkets(d.markets);
    } catch {
      /* терминал переживаетnetwork-сбои */
    }
  }, []);

  /* оракул-ключ живёт в localStorage: повторный визит — сразу в консоль */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nr-oracle-key");
      if (saved) setKey(saved);
    } catch {
      /* приватный режим */
    }
  }, []);

  /* поллинг рынка в консоли */
  useEffect(() => {
    if (!authed) return;
    void loadMarkets();
    const iv = setInterval(loadMarkets, 5000);
    return () => clearInterval(iv);
  }, [authed, loadMarkets]);

  const verifyKey = useCallback(
    async (candidate: string) => {
      setKeyError(null);
      try {
        const r = await fetch(`/api/admin/cryo/resolve?key=${encodeURIComponent(candidate)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ probe: true }),
        });
        if (r.status === 401) {
          setKeyError("ACCESS DENIED — oracle key mismatch");
          setAuthed(false);
          return false;
        }
        // 400 (probe без postCode) = ключ принят
        setAuthed(true);
        try {
          localStorage.setItem("nr-oracle-key", candidate);
        } catch {
          /* приватный режим */
        }
        return true;
      } catch {
        setKeyError("terminal link failure — retry");
        return false;
      }
    },
    []
  );

  /* авто-проверка сохранённого ключа */
  useEffect(() => {
    if (key && !authed) void verifyKey(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Hold-to-confirm (1.5s) — по кнопке на КАЖДУЮ опцию рынка ── */
  const startHold = (postCode: string, result: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (holdKey) return;
    setHoldKey(`${postCode}:${result}`);
    holdStart.current = performance.now();
    const tick = () => {
      const pct = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS);
      setHoldPct(pct);
      if (pct >= 1) {
        setHoldKey(null);
        setHoldPct(0);
        setSigning({ postCode, result });
      } else {
        holdRaf.current = requestAnimationFrame(tick);
      }
    };
    holdRaf.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    cancelAnimationFrame(holdRaf.current);
    setHoldKey(null);
    setHoldPct(0);
  };

  /* ── финализация: подпись оракула (второй фактор) ── */
  const signResolution = useCallback(
    async (postCode: string, result: string) => {
      setBusy(postCode);
      try {
        const r = await fetch(`/api/admin/cryo/resolve?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postCode, result }),
        });
        const d = (await r.json()) as { error?: string };
        if (!r.ok) {
          setKeyError(d.error || `oracle rejected (${r.status})`);
        } else {
          setKeyError(null);
          await loadMarkets();
        }
      } catch {
        setKeyError("oracle uplink failure");
      } finally {
        setBusy(null);
        setSigning(null);
      }
    },
    [key, loadMarkets]
  );

  const adminAction = useCallback(
    async (postCode: string, action: "expire", inSec?: number) => {
      setBusy(postCode);
      try {
        await fetch(`/api/admin/cryo/resolve?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postCode, action, inSec }),
        });
        await loadMarkets();
      } finally {
        setBusy(null);
      }
    },
    [key, loadMarkets]
  );

  /* ── ── ── gate: доступ по оракул-ключу ── ── ── */
  if (!authed) {
    return (
      <div className="nr-oracle-shell">
        <div className="nr-oracle-gate">
          <p className="nr-oracle-eyebrow">cryogenic biolab · chamber control</p>
          <h1 className="nr-oracle-title">ORACLE CONSOLE</h1>
          <p className="nr-oracle-note">
            [ AWAITING ORACLE SIGNATURE ] — insert hardware key to unlock resolution
            terminal
          </p>
          <form
            className="nr-oracle-gate-form"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyKey(key);
            }}
          >
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="oracle key"
              className="nr-oracle-input"
              autoComplete="off"
              aria-label="Oracle key"
            />
            <button type="submit" className="nr-oracle-verify">
              VERIFY
            </button>
          </form>
          {keyError && <p className="nr-oracle-err">{keyError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="nr-oracle-shell">
      <header className="nr-oracle-head">
        <div>
          <p className="nr-oracle-eyebrow">cryogenic biolab · chamber control</p>
          <h1 className="nr-oracle-title">ORACLE CONSOLE</h1>
        </div>
        <p className="nr-oracle-uptime">
          chambers: {markets.length} · resolved:{" "}
          {markets.filter((m) => m.status === "resolved").length} · link:{" "}
          <b>STABLE</b>
        </p>
      </header>

      {keyError && <p className="nr-oracle-err">{keyError}</p>}

      <div className="nr-oracle-grid">
        {markets.map((m) => {
          const post = postByCode.get(m.postCode);
          return (
            <article key={m.postCode} className="nr-oracle-card">
              {/* стоп-кадр в титановой рамке */}
              <div className="nr-oracle-frame">
                {post?.videoUrl ? (
                  <video
                    src={post.videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      v.currentTime = Math.min(1.2, (v.duration || 2) * 0.35);
                    }}
                  />
                ) : (
                  <span className="nr-oracle-frame-missing">FRAME LOST</span>
                )}
                <span className="nr-oracle-frame-code">{m.postCode}</span>
              </div>

              <div className="nr-oracle-data">
                <p className="nr-oracle-q">{m.question}</p>

                {/* task 44: пулы по КАЖДОЙ опции (не только yes/no) */}
                <div className="nr-oracle-stats">
                  {m.options.map((o, i) => (
                    <span key={o.key}>
                      {o.label.slice(0, 16).toUpperCase()} <b style={i === 0 ? { color: m.accent } : undefined}>${o.pool.toFixed(2)}</b> <small>({o.pct}%)</small>
                    </span>
                  ))}
                  <span>
                    POSITIONS <b>{m.betsCount}</b>
                  </span>
                  <span>
                    STATUS{" "}
                    <b
                      className={
                        m.status === "resolved"
                          ? "nr-oracle-st-resolved"
                          : m.status === "expired"
                            ? "nr-oracle-st-expired"
                            : "nr-oracle-st-live"
                      }
                    >
                      {m.status.toUpperCase()}
                    </b>
                  </span>
                </div>

                {m.status === "resolved" ? (
                  <p className="nr-oracle-verdict nr-oracle-verdict-yes">
                    [ VERDICT: {m.options.find((o) => o.key === m.result)?.label ?? m.result} ]
                  </p>
                ) : (
                  <>
                    <p className="nr-oracle-awaiting">[ AWAITING ORACLE SIGNATURE ]</p>

                    {/* тумблеры тяжёлого типа: hold-to-confirm 1.5s — по одному на опцию */}
                    <div className="nr-oracle-toggles">
                      {m.options.map((o) => {
                        const hold = holdKey === `${m.postCode}:${o.key}`;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            onPointerDown={startHold(m.postCode, o.key)}
                            onPointerUp={cancelHold}
                            onPointerLeave={hold ? cancelHold : undefined}
                            disabled={busy === m.postCode}
                            className={`nr-oracle-toggle nr-oracle-toggle-yes ${
                              hold ? "nr-oracle-holding" : ""
                            }`}
                            style={
                              hold
                                ? ({ "--hold": `${holdPct * 100}%` } as React.CSSProperties)
                                : undefined
                            }
                          >
                            {o.label.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                    <p className="nr-oracle-hold-note">
                      hold 1.5s to charge the circuit · release aborts
                    </p>

                    <div className="nr-oracle-admin">
                      <button
                        type="button"
                        onClick={() => void adminAction(m.postCode, "expire")}
                        disabled={busy === m.postCode}
                        className="nr-oracle-admin-btn"
                      >
                        FREEZE NOW
                      </button>
                      <button
                        type="button"
                        onClick={() => void adminAction(m.postCode, "expire", 10)}
                        disabled={busy === m.postCode}
                        className="nr-oracle-admin-btn"
                      >
                        EXPIRE +10s (boil test)
                      </button>
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {markets.length === 0 && (
          <p className="nr-oracle-empty">chambers empty — no live markets</p>
        )}
      </div>

      {/* подпись куратора: второй фактор */}
      {signing && (
        <div className="nr-oracle-sign" role="dialog" aria-modal>
          <div className="nr-oracle-sign-card">
            <p className="nr-oracle-eyebrow">hardware signature required</p>
            <p className="nr-oracle-sign-q">
              FINALIZE “
              {markets
                .find((m) => m.postCode === signing.postCode)
                ?.options.find((o) => o.key === signing.result)?.label ??
                signing.result}
              ” on chamber {signing.postCode}?
            </p>
            <p className="nr-oracle-note">
              This settles the pari-mutuel pool and is irreversible.
            </p>
            <div className="nr-oracle-sign-row">
              <button
                type="button"
                className="nr-oracle-sign-go"
                onClick={() => void signResolution(signing.postCode, signing.result)}
                disabled={busy === signing.postCode}
              >
                {busy === signing.postCode ? "SIGNING…" : "SIGN WITH ORACLE KEY"}
              </button>
              <button
                type="button"
                className="nr-oracle-sign-cancel"
                onClick={() => setSigning(null)}
              >
                ABORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
