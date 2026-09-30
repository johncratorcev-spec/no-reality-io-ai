"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CryoMarketView } from "@/lib/cryo/core";

/* ================================================================
   Block 8 + v7: пульт управления криокамерами биолаборатории.

   v7 ИЗМЕНЕНИЯ:
   - вход по СЕКРЕТНОМУ КОДУ: POST /api/admin/session → httpOnly
     HMAC-cookie nr_admin на 12ч. Ключ больше НЕ хранится в localStorage
     и не гоняется в каждом запросе (?key= остался только для curl).
   - вкладки: MARKETS (криокамеры) · ROUNDS (форс-вердикт REAL/SYNTH) ·
     EVENTS (создать фото/видео-событие одним полем URL).
   - white-label iframe: /admin/resolution?wl=Brand&accent=%23c8ff00&embed=1
     — бренд и акцент подменяются, ?embed=1 прячет «тяжёлую» шапку.
   ================================================================ */

interface PostStatic {
  code: string;
  videoUrl: string;
  title: string;
  author: string;
}

interface RoundRow {
  id: string;
  clipCode: string;
  status: string;
  poolRealCents: number;
  poolSynthCents: number;
  resolvedAs: string | null;
  closesAt: string;
  bets: number;
}

const HOLD_MS = 1500;

type Tab = "markets" | "rounds" | "events";

function readWlParams(): { brand: string | null; accent: string | null; embed: boolean } {
  if (typeof window === "undefined") return { brand: null, accent: null, embed: false };
  const q = new URLSearchParams(window.location.search);
  const accentRaw = q.get("accent");
  return {
    brand: (q.get("wl") || "").slice(0, 40) || null,
    accent: accentRaw && /^#[0-9a-fA-F]{3,8}$/.test(accentRaw) ? accentRaw : null,
    embed: q.get("embed") === "1",
  };
}

export default function OracleConsole({ posts }: { posts: PostStatic[] }) {
  const [tab, setTab] = useState<Tab>("markets");
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<CryoMarketView[]>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [signing, setSigning] = useState<{ postCode: string; result: string } | null>(null);
  const [holdKey, setHoldKey] = useState<string | null>(null);
  const holdRaf = useRef<number>(0);
  const holdStart = useRef<number>(0);
  const [holdPct, setHoldPct] = useState(0);

  /* white-label (iframe) */
  const [wl, setWl] = useState({ brand: null as string | null, accent: null as string | null, embed: false });
  useEffect(() => setWl(readWlParams()), []);
  const accentColor = wl.accent || "#5ad1ff";

  /* events form */
  const [evTitle, setEvTitle] = useState("");
  const [evAuthor, setEvAuthor] = useState("");
  const [evUrl, setEvUrl] = useState("");
  const [evTruth, setEvTruth] = useState<"real" | "synth">("synth");
  const [evMood, setEvMood] = useState("swag");
  const [evMsg, setEvMsg] = useState<string | null>(null);

  const postByCode = new Map(posts.map((p) => [p.code, p]));

  const loadMarkets = useCallback(async () => {
    try {
      const r = await fetch("/api/cryo/markets", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { markets?: CryoMarketView[] };
      if (d.markets) setMarkets(d.markets);
    } catch {
      /* терминал переживает network-сбои */
    }
  }, []);

  const loadRounds = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/rounds", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { rounds?: RoundRow[] };
      if (d.rounds) setRounds(d.rounds);
    } catch {
      /* поллинг переживёт */
    }
  }, []);

  /* сессия: cookie жива? (localStorage хранит только удобный флаг) */
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/admin/session", { cache: "no-store" });
        const d = (await r.json()) as { authed?: boolean };
        if (d.authed) setAuthed(true);
        else {
          try {
            localStorage.removeItem("nr-admin-authed");
          } catch {}
        }
      } catch {
        /* офлайн — покажем гейт */
      }
    })();
  }, []);

  /* поллинг вкладок */
  useEffect(() => {
    if (!authed) return;
    if (tab === "markets") void loadMarkets();
    if (tab === "rounds") void loadRounds();
    const iv = setInterval(() => {
      if (tab === "markets") void loadMarkets();
      if (tab === "rounds") void loadRounds();
    }, 5000);
    return () => clearInterval(iv);
  }, [authed, tab, loadMarkets, loadRounds]);

  const login = useCallback(
    async (candidate: string) => {
      setKeyError(null);
      try {
        const r = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: candidate }),
        });
        if (r.status === 401) {
          setKeyError("ACCESS DENIED — oracle code mismatch");
          return false;
        }
        if (r.status === 429) {
          setKeyError("LOCKOUT — too many attempts, wait a minute");
          return false;
        }
        if (!r.ok) {
          setKeyError(`terminal link failure (${r.status})`);
          return false;
        }
        setAuthed(true);
        setCode("");
        try {
          localStorage.setItem("nr-admin-authed", "1");
        } catch {}
        return true;
      } catch {
        setKeyError("terminal link failure — retry");
        return false;
      }
    },
    []
  );

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

  /* ── финализация: подпись оракула (cookie-сессия) ── */
  const signResolution = useCallback(
    async (postCode: string, result: string) => {
      setBusy(postCode);
      try {
        const r = await fetch("/api/admin/cryo/resolve", {
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
    [loadMarkets]
  );

  const adminAction = useCallback(
    async (postCode: string, action: "expire", inSec?: number) => {
      setBusy(postCode);
      try {
        await fetch("/api/admin/cryo/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postCode, action, inSec }),
        });
        await loadMarkets();
      } finally {
        setBusy(null);
      }
    },
    [loadMarkets]
  );

  const forceRound = useCallback(
    async (roundId: string, verdict: "real" | "synth") => {
      setBusy(roundId);
      try {
        const r = await fetch("/api/admin/rounds", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roundId, verdict }),
        });
        const d = (await r.json()) as { error?: string };
        if (!r.ok) setKeyError(d.error || `rejected (${r.status})`);
        else {
          setKeyError(null);
          await loadRounds();
        }
      } catch {
        setKeyError("uplink failure");
      } finally {
        setBusy(null);
      }
    },
    [loadRounds]
  );

  const createEvent = useCallback(async () => {
    setBusy("event");
    setEvMsg(null);
    try {
      const r = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: evTitle,
          author: evAuthor,
          url: evUrl,
          truth: evTruth,
          mood: evMood,
          /* видео-URL или фото-URL: определяем по расширению/домену */
          videoUrl: /\.(mp4|m3u8|webm)(\?|$)/i.test(evUrl) || evUrl.includes("/v/") ? evUrl : "",
          imageUrl: /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(evUrl) ? evUrl : "",
        }),
      });
      const d = (await r.json()) as { ok?: boolean; code?: string; media?: string; error?: string };
      if (!r.ok || d.error) {
        setEvMsg(`ERROR: ${d.error || r.status}`);
      } else {
        setEvMsg(`OK · code ${d.code} · ${d.media} · уже в ленте`);
        setEvTitle("");
        setEvUrl("");
      }
    } catch {
      setEvMsg("ERROR: uplink failure");
    } finally {
      setBusy(null);
    }
  }, [evTitle, evAuthor, evUrl, evTruth, evMood]);

  /* ── ── ── gate: вход по секретному коду ── ── ── */
  if (!authed) {
    return (
      <div className="nr-oracle-shell">
        <div className="nr-oracle-gate">
          <p className="nr-oracle-eyebrow">
            {wl.brand ? `${wl.brand} · chamber control` : "cryogenic biolab · chamber control"}
          </p>
          <h1 className="nr-oracle-title" style={wl.brand ? { color: accentColor } : undefined}>
            {wl.brand ? wl.brand.toUpperCase() : "ORACLE CONSOLE"}
          </h1>
          <p className="nr-oracle-note">
            [ AWAITING ORACLE SIGNATURE ] — enter the secret code to unlock the
            resolution terminal
          </p>
          <form
            className="nr-oracle-gate-form"
            onSubmit={(e) => {
              e.preventDefault();
              void login(code);
            }}
          >
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="secret code"
              className="nr-oracle-input"
              autoComplete="off"
              aria-label="Oracle secret code"
            />
            <button type="submit" className="nr-oracle-verify">
              UNLOCK
            </button>
          </form>
          {keyError && <p className="nr-oracle-err">{keyError}</p>}
        </div>
      </div>
    );
  }

  const btnStyle: React.CSSProperties = {
    border: `1px solid ${accentColor}44`,
    color: accentColor,
    background: "rgba(255,255,255,.03)",
  };

  return (
    <div className="nr-oracle-shell">
      <header className="nr-oracle-head">
        <div>
          <p className="nr-oracle-eyebrow">
            {wl.brand ? `${wl.brand} · chamber control` : "cryogenic biolab · chamber control"}
          </p>
          <h1 className="nr-oracle-title" style={wl.brand ? { color: accentColor } : undefined}>
            {wl.brand ? wl.brand.toUpperCase() : "ORACLE CONSOLE"}
          </h1>
        </div>
        {!wl.embed && (
          <p className="nr-oracle-uptime">
            chambers: {markets.length} · rounds: {rounds.length} · link: <b>STABLE</b>
          </p>
        )}
      </header>

      {/* вкладки */}
      <div className="nr-oracle-tabs" role="tablist" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(["markets", "rounds", "events"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className="nr-oracle-toggle"
            style={{
              ...(tab === t ? { background: accentColor, color: "#04070c", borderColor: accentColor } : btnStyle),
              padding: "8px 14px",
              fontSize: 11,
              letterSpacing: ".18em",
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            void fetch("/api/admin/session", { method: "DELETE" }).then(() => {
              try {
                localStorage.removeItem("nr-admin-authed");
              } catch {}
              setAuthed(false);
            });
          }}
          className="nr-oracle-admin-btn"
          style={{ marginLeft: "auto", padding: "8px 12px", fontSize: 11 }}
        >
          LOCK
        </button>
      </div>

      {keyError && <p className="nr-oracle-err">{keyError}</p>}

      {/* ---------- MARKETS (cryo) ---------- */}
      {tab === "markets" && (
        <div className="nr-oracle-grid">
          {markets.map((m) => {
            const post = postByCode.get(m.postCode);
            return (
              <article key={m.postCode} className="nr-oracle-card">
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

                  <div className="nr-oracle-stats">
                    {m.options.map((o, i) => (
                      <span key={o.key}>
                        {o.label.slice(0, 16).toUpperCase()}{" "}
                        <b style={i === 0 ? { color: m.accent } : undefined}>
                          ${o.pool.toFixed(2)}
                        </b>{" "}
                        <small>({o.pct}%)</small>
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
      )}

      {/* ---------- ROUNDS (REAL/SYNTH форс-вердикт) ---------- */}
      {tab === "rounds" && (
        <div className="nr-oracle-grid">
          {rounds.map((r) => (
            <article key={r.id} className="nr-oracle-card">
              <div className="nr-oracle-data">
                <p className="nr-oracle-q">
                  {postByCode.get(r.clipCode)?.title || r.clipCode}
                </p>
                <div className="nr-oracle-stats">
                  <span>
                    REAL <b>{r.poolRealCents} EYE</b>
                  </span>
                  <span>
                    SYNTH <b>{r.poolSynthCents} EYE</b>
                  </span>
                  <span>
                    POSITIONS <b>{r.bets}</b>
                  </span>
                  <span>
                    STATUS{" "}
                    <b
                      className={
                        r.status === "resolved"
                          ? "nr-oracle-st-resolved"
                          : r.status === "locked"
                            ? "nr-oracle-st-expired"
                            : "nr-oracle-st-live"
                      }
                    >
                      {(r.resolvedAs || r.status).toUpperCase()}
                    </b>
                  </span>
                </div>
                {r.status === "resolved" ? (
                  <p className="nr-oracle-verdict nr-oracle-verdict-yes">
                    [ VERDICT: {r.resolvedAs?.toUpperCase()} ]
                  </p>
                ) : (
                  <div className="nr-oracle-toggles">
                    {(["real", "synth"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void forceRound(r.id, v)}
                        className="nr-oracle-toggle nr-oracle-toggle-yes"
                        style={btnStyle}
                      >
                        CLOSE AS {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
          {rounds.length === 0 && (
            <p className="nr-oracle-empty">no rounds yet — the raffles feed is quiet</p>
          )}
        </div>
      )}

      {/* ---------- EVENTS (создать фото/видео) ---------- */}
      {tab === "events" && (
        <div className="nr-oracle-card" style={{ maxWidth: 640 }}>
          <div className="nr-oracle-data">
            <p className="nr-oracle-q">NEW EVENT — photo or video, one URL away</p>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="title (обязательно)"
                className="nr-oracle-input"
                maxLength={220}
              />
              <input
                value={evAuthor}
                onChange={(e) => setEvAuthor(e.target.value)}
                placeholder="author @handle"
                className="nr-oracle-input"
                maxLength={80}
              />
              <input
                value={evUrl}
                onChange={(e) => setEvUrl(e.target.value)}
                placeholder="https://… (mp4/webm = видео · png/jpg/webp/gif = фото)"
                className="nr-oracle-input"
                inputMode="url"
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["real", "synth"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEvTruth(t)}
                    className="nr-oracle-toggle"
                    style={{
                      ...(evTruth === t
                        ? { background: accentColor, color: "#04070c", borderColor: accentColor }
                        : btnStyle),
                      padding: "8px 14px",
                      fontSize: 11,
                    }}
                  >
                    TRUTH: {t.toUpperCase()}
                  </button>
                ))}
                <select
                  value={evMood}
                  onChange={(e) => setEvMood(e.target.value)}
                  className="nr-oracle-input"
                  style={{ width: "auto", padding: "8px 10px" }}
                  aria-label="mood"
                >
                  {["swag", "creepy", "future", "ufo"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void createEvent()}
                disabled={busy === "event" || !evTitle.trim() || !evUrl.trim()}
                className="nr-oracle-verify"
                style={{ width: "fit-content" }}
              >
                {busy === "event" ? "PUBLISHING…" : "PUBLISH EVENT"}
              </button>
              {evMsg && <p className="nr-oracle-note">{evMsg}</p>}
              <p className="nr-oracle-hold-note">
                Событие появится в лентах сразу (CSV перечитывается по mtime).
                Фото — прямой https-URL картинки; видео — прямой https-URL mp4/webm.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* подпись куратора: hold-to-confirm уже сделан на клиенте */}
      {signing && (
        <div className="nr-oracle-sign" role="dialog" aria-modal>
          <div className="nr-oracle-sign-card">
            <p className="nr-oracle-eyebrow">oracle signature required</p>
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
                {busy === signing.postCode ? "SIGNING…" : "SIGN VERDICT"}
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
