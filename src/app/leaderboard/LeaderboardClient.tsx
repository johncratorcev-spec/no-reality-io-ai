"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { fmtCoins } from "@/lib/econ";

/* ================================================================
   v13 — «ГЛАЗ БОГА»: сезонный лидерборд.
   Топ-50 по winrate → net → volume; своя строка видна ВСЕГДА
   (закреплена сверху, даже если ранг за пределами топа).
   Бейджи: god-eye / eagle / unstoppable / whale…
   Обновление — каждые 30с (лёгкий polling, no-store).
   ================================================================ */

interface Row {
  rank: number;
  accountId: string;
  name: string | null;
  handle: string | null;
  bets: number;
  correct: number;
  winrate: number;
  volumeCents: number;
  netCents: number;
  streak: number;
  bestStreak: number;
  badges: string[];
}

interface Payload {
  ok?: boolean;
  season?: { code: string; name: string; endsAt: string } | null;
  top?: Row[];
  me?: Row | null;
  updatedAt?: string;
}

const BADGE_STYLE: Record<string, string> = {
  "god-eye": "border-[#c8ff00] text-[#c8ff00]",
  eagle: "border-[#c8ff00]/60 text-[#c8ff00]",
  sharp: "border-white/25 text-white/70",
  unstoppable: "border-[#ff003c] text-[#ff003c]",
  "hot-hand": "border-[#ffb800]/70 text-[#ffb800]",
  "warming-up": "border-white/20 text-white/60",
  whale: "border-cyan-300/50 text-cyan-200",
  "high-roller": "border-white/25 text-white/65",
};

function Badge({ id, label }: { id: string; label: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] ${BADGE_STYLE[id] ?? "border-white/20 text-white/60"}`}
    >
      {label}
    </span>
  );
}

function PlayerName({ r }: { r: Row }) {
  const label = r.name || r.handle || `eye #${r.rank}`;
  return <span className="truncate font-extrabold">{label}</span>;
}

function RowLine({
  r,
  mine,
  youLabel,
  badgeLabel,
}: {
  r: Row;
  mine?: boolean;
  youLabel: string;
  badgeLabel: (b: string) => string;
}) {
  return (
    <li
      className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${
        mine
          ? "border-[#c8ff00]/60 bg-[rgba(200,255,0,0.07)]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <span
        className={`w-7 shrink-0 text-center text-[0.8rem] font-black ${
          r.rank === 1 ? "text-[#c8ff00]" : r.rank <= 3 ? "text-white/85" : "text-white/40"
        }`}
      >
        {r.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`max-w-[10rem] truncate text-[0.86rem] ${mine ? "text-[#c8ff00]" : ""}`}>
            <PlayerName r={r} />
          </span>
          {mine && (
            <span className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-[#c8ff00]">
              {youLabel}
            </span>
          )}
          {r.badges.slice(0, 2).map((b) => (
            <Badge key={b} id={b} label={badgeLabel(b)} />
          ))}
        </span>
        <span className="mt-0.5 flex gap-2.5 text-[0.6rem] font-bold text-white/35">
          <span>{r.correct}/{r.bets}</span>
          <span>×{r.streak}</span>
          <span>{r.netCents >= 0 ? "+" : ""}{fmtCoins(r.netCents)}</span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className="text-[1.02rem] font-black leading-none"
          style={{ color: r.winrate >= 60 ? "#c8ff00" : "rgba(242,237,228,.85)" }}
        >
          {r.winrate}%
        </span>
        <span className="mt-0.5 block text-[0.55rem] font-bold uppercase tracking-wider text-white/30">
          {fmtCoins(r.volumeCents)} EYE
        </span>
      </span>
    </li>
  );
}

export default function LeaderboardClient() {
  const { t } = useLang();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/leaderboard?limit=50", { cache: "no-store" });
        const d = (await r.json()) as Payload;
        if (alive) {
          setData(d);
          setErr(false);
        }
      } catch {
        if (alive) setErr(true);
      }
    };
    void load();
    const iv = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const top = data?.top ?? [];
  const me = data?.me ?? null;
  const meInTop = me ? top.some((r) => r.accountId === me.accountId) : false;
  const seasonEnds = data?.season?.endsAt
    ? new Date(data.season.endsAt).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const badgeLabel = (b: string) => t.lb.badges[b as keyof typeof t.lb.badges] ?? b;

  return (
    <div>
      {/* ---------- заголовок ---------- */}
      <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-[#c8ff00]">
        {t.lb.kicker}
      </p>
      <h1 className="mt-2 text-[2.4rem] font-black leading-none tracking-tight">
        {t.lb.title}
      </h1>
      <p className="mt-2 text-[0.82rem] font-semibold text-white/50">{t.lb.sub}</p>
      {seasonEnds && (
        <p className="mt-1.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/30">
          {t.lb.season} {data?.season?.code?.toUpperCase()} · {t.lb.ends} {seasonEnds}
        </p>
      )}

      {/* ---------- своя позиция (всегда видна) ---------- */}
      {me && !meInTop && (
        <ul className="mt-5">
          <li className="mb-1 flex items-center gap-1.5 text-[0.58rem] font-black uppercase tracking-[0.2em] text-[#c8ff00]/70">
            <span aria-hidden>▾</span> {t.lb.you}
          </li>
          <RowLine r={me} mine youLabel={t.lb.you} badgeLabel={badgeLabel} />
        </ul>
      )}

      {/* ---------- топ ---------- */}
      {top.length > 0 ? (
        <ul className="mt-5 space-y-1.5">
          {top.map((r) => (
            <RowLine
              key={r.accountId}
              r={r}
              mine={me?.accountId === r.accountId}
              youLabel={t.lb.you}
              badgeLabel={badgeLabel}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center text-[0.8rem] font-bold text-white/45">
          {err ? t.bet.networkDown : t.lb.empty}
        </p>
      )}

      {top.length > 0 && (
        <p className="mt-4 text-center text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white/25">
          {t.lb.minBets}
        </p>
      )}
    </div>
  );
}
