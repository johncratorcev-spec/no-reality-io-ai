"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Star, Target, Upload } from "lucide-react";

/**
 * v13 — BD-консоль (мобиль-first): раскладка сезона + быстрая заливка
 * клипов (Threads/X) + Featured / Daily Challenge в два тапа.
 * Данные: GET /api/admin/bd/summary; действия: POST add-video / feature.
 */

interface Summary {
  ok?: boolean;
  season?: { code: string; name: string; daysLeft: number; snapshotLabel: string } | null;
  open: {
    count: number;
    bankCents: number;
    rounds: { id: string; clip: string; real: number; synth: number; challenge: boolean; closesAt: string }[];
  };
  top: { id: string; clip: string; bank: number; resolvedAs: string | null; challenge: boolean }[];
  participants: number;
  seasonVolume: number;
  seasonSettled: number;
  last24: { bets: number; volume: number; newAccounts: number };
  last7: { bets: number; volume: number; newAccounts: number };
  daily: { clip: string; label: string } | null;
  featured: { clip: string; until: string | null }[];
}

const coins = (c: number) => String(Math.round(c));

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[0.52rem] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className={`mt-1 text-[1.05rem] font-black leading-none ${accent ? "text-[#c8ff00]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

export default function BdConsole() {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  /* форма добавления */
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [truth, setTruth] = useState("");
  /* v15 — бейдж соревнования (raffle-NN): золотое оформление */
  const [badge, setBadge] = useState("");

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/admin/bd/summary", { cache: "no-store" });
        if (r.status === 401) {
          window.location.href = "/admin/bd";
          return;
        }
        const d = (await r.json()) as Summary;
        if (alive) {
          setData(d);
          setErr(false);
        }
      } catch {
        if (alive) setErr(true);
      }
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const refresh = useCallback(() => {
    setErr(false);
    void (async () => {
      try {
        const r = await fetch("/api/admin/bd/summary", { cache: "no-store" });
        if (r.status === 401) {
          window.location.href = "/admin/bd";
          return;
        }
        const d = (await r.json()) as Summary;
        setData(d);
      } catch {
        setErr(true);
      }
    })();
  }, []);

  const addVideo = async () => {
    if (busy || !url.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/bd/add-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, video, title, author, truth, badge }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string; result?: { utm: string; author: string } };
      if (r.ok && d.ok) {
        setMsg(`✓ добавлено: ${d.result?.utm} (${d.result?.author})`);
        setUrl("");
        setVideo("");
        setTitle("");
        setAuthor("");
        void refresh();
      } else {
        setMsg(`✕ ${d.error ?? "failed"}`);
      }
    } catch {
      setMsg("✕ network blinked");
    }
    setBusy(false);
  };

  const mark = async (kind: "featured" | "daily", clip: string, on = true) => {
    setMsg("");
    try {
      const r = await fetch("/api/admin/bd/feature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, clip, on }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string; marked?: number };
      if (r.ok && d.ok) {
        setMsg(kind === "daily" ? `✓ daily → ${clip} (${d.marked} rounds)` : `✓ featured ${on ? "on" : "off"} → ${clip}`);
        void refresh();
      } else {
        setMsg(`✕ ${d.error ?? "failed"}`);
      }
    } catch {
      setMsg("✕ network blinked");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      {/* ---------- шапка ---------- */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.58rem] font-black uppercase tracking-[0.3em] text-[#c8ff00]">bd console</p>
          <h1 className="mt-1 text-xl font-black tracking-tight">
            no-reality<span className="text-[#FF003C]">.</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            aria-label="refresh"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white/60 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/admin/resolution"
            className="rounded-full border border-white/12 px-3 py-2 text-[0.62rem] font-black uppercase tracking-wider text-white/60 hover:text-white"
          >
            oracle
          </Link>
          <Link
            href="/admin/bd-guide"
            className="rounded-full bg-white/10 px-3 py-2 text-[0.62rem] font-black uppercase tracking-wider text-white/80 hover:text-white"
          >
            guide
          </Link>
        </div>
      </div>

      {err && <p className="mt-4 text-[0.75rem] font-bold text-[#ff003c]">summary failed — refresh</p>}
      {msg && <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.7rem] font-bold">{msg}</p>}

      {/* ---------- раскладка ---------- */}
      {data && (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="season" value={data.season ? `${data.season.code} · d${data.season.daysLeft}` : "—"} />
            <Stat label="participants" value={String(data.participants)} />
            <Stat label="season volume" value={`${coins(data.seasonVolume)} EYE`} accent />
            <Stat label="open rounds" value={String(data.open.count)} />
            <Stat label="open bank" value={`${coins(data.open.bankCents)} EYE`} />
            <Stat label="settled bets" value={String(data.seasonSettled)} />
            <Stat label="24h bets" value={String(data.last24.bets)} />
            <Stat label="24h new accs" value={String(data.last24.newAccounts)} />
            <Stat label="7d volume" value={`${coins(data.last7.volume)} EYE`} />
          </div>

          {/* ---------- daily + featured ---------- */}
          <section className="mt-6">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.24em] text-white/40">today’s marks</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.68rem] font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,184,0,0.4)] bg-[rgba(255,184,0,0.08)] px-3 py-1.5 text-[#ffb800]">
                <Target className="h-3 w-3" aria-hidden />
                daily: {data.daily?.clip ?? "— not set —"}
              </span>
              {data.featured.length > 0 ? (
                data.featured.map((f) => (
                  <span key={f.clip} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-white/70">
                    <Star className="h-3 w-3 text-[#c8ff00]" aria-hidden />
                    {f.clip}
                  </span>
                ))
              ) : (
                <span className="text-white/30">no featured clips</span>
              )}
            </div>
          </section>

          {/* ---------- топ-раунды ---------- */}
          <section className="mt-6">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.24em] text-white/40">top rounds by bank (season)</p>
            <ul className="mt-2 space-y-1.5">
              {data.top.length === 0 && <li className="text-[0.72rem] font-semibold text-white/35">no settled rounds yet</li>}
              {data.top.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[0.7rem]">
                  <span className="w-24 shrink-0 truncate font-bold text-white/80">{r.clip}</span>
                  <span className="font-black text-[#c8ff00]">{coins(r.bank)}</span>
                  <span className="text-white/35">EYE</span>
                  <span className={`ml-auto font-black uppercase ${r.resolvedAs === "real" ? "text-[#c8ff00]" : "text-[#ff003c]"}`}>
                    {r.resolvedAs ?? "?"}
                  </span>
                  <button
                    onClick={() => void mark("featured", r.clip, !data.featured.some((f) => f.clip === r.clip))}
                    className="rounded-full border border-white/12 px-2 py-1 text-[0.56rem] font-black uppercase text-white/60 hover:text-white"
                  >
                    {data.featured.some((f) => f.clip === r.clip) ? "unfeature" : "feature"}
                  </button>
                  <button
                    onClick={() => void mark("daily", r.clip)}
                    className="rounded-full border border-[rgba(255,184,0,0.4)] px-2 py-1 text-[0.56rem] font-black uppercase text-[#ffb800]"
                  >
                    daily
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* ---------- заливка клипа ---------- */}
      <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="flex items-center gap-2 text-[0.58rem] font-black uppercase tracking-[0.24em] text-white/40">
          <Upload className="h-3.5 w-3.5" aria-hidden /> add video — threads / x
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.threads.com/share/… или https://x.com/user/status/…"
          className="mt-3 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 py-2.5 text-[0.78rem] font-bold text-white outline-none focus:border-[#c8ff00]/50"
        />
        <input
          value={video}
          onChange={(e) => setVideo(e.target.value)}
          placeholder="video …mp4 address (обязателен; для X — копируй вручную)"
          className="mt-2 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 py-2.5 text-[0.78rem] font-bold text-white outline-none focus:border-[#c8ff00]/50"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="title (optional)"
            className="w-full rounded-xl border border-white/12 bg-black/40 px-3.5 py-2.5 text-[0.78rem] font-bold text-white outline-none focus:border-[#c8ff00]/50"
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="author @… (optional)"
            className="w-full rounded-xl border border-white/12 bg-black/40 px-3.5 py-2.5 text-[0.78rem] font-bold text-white outline-none focus:border-[#c8ff00]/50"
          />
        </div>
        <input
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          placeholder="competition badge (optional): raffle-01 — золотое оформление первого соревнования"
          className="mt-2 w-full rounded-xl border border-[#ffd24a]/25 bg-black/40 px-3.5 py-2.5 text-[0.78rem] font-bold text-white outline-none focus:border-[#ffd24a]/60"
        />
        <div className="mt-2 flex items-center gap-2">
          <select
            value={truth}
            onChange={(e) => setTruth(e.target.value)}
            aria-label="verdict"
            className="flex-1 rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[0.78rem] font-bold text-white outline-none"
          >
            <option value="">verdict: resolve later (oracle)</option>
            <option value="real">REAL — живая съёмка</option>
            <option value="synth">SYNTH — синтетика</option>
          </select>
          <button
            onClick={() => void addVideo()}
            disabled={busy || !url.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-[#c8ff00] px-5 py-2.5 text-[0.78rem] font-black text-[#0B0910] disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            create
          </button>
        </div>
        <p className="mt-2 text-[0.6rem] font-semibold leading-relaxed text-white/30">
          Threads парсится автоматически (title/author). X: метаданные best-effort,
          адрес видео копируй из поста вручную — у X нет публичного прямого mp4.
        </p>
      </section>
    </div>
  );
}
