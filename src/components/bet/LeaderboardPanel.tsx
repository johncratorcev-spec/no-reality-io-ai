"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Trophy, X } from "lucide-react";
import { fmtUsd } from "@/lib/bet/config";
import { useLang } from "@/lib/i18n";

/**
 * God Eye Leaderboard (v13): сезонный топ точности по аккаунтам
 * (было: недельный топ по legacy-кошелькам). Источник — публичный
 * GET /api/leaderboard. Своя позиция видна всегда. Полная страница —
 * /leaderboard.
 */

interface EyeRow {
  rank: number;
  accountId: string;
  name: string | null;
  handle: string | null;
  bets: number;
  correct: number;
  winrate: number;
  netCents: number;
  streak: number;
}

interface LBData {
  top?: EyeRow[];
  me?: EyeRow | null;
}

export default function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<LBData | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLang();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/leaderboard?limit=10", { cache: "no-store" });
      if (!r.ok) throw new Error("failed");
      setData((await r.json()) as LBData);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const rows = data?.top ?? [];
  const me = data?.me ?? null;
  const meInTop = me ? rows.some((r) => r.accountId === me.accountId) : false;

  const nameOf = (r: EyeRow) =>
    r.name || r.handle || `eye #${r.rank}`;

  return (
    <div
      role="dialog"
      aria-label="best eyes leaderboard"
      className="absolute inset-0 z-[60] flex items-end justify-center bg-[rgba(4,3,8,0.8)] px-3 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
      onClick={onClose}
    >
      <div
        className="nb-panel w-full max-w-md rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(200,255,0,.12)", border: "1px solid rgba(200,255,0,.35)" }}
            >
              <Trophy className="h-5 w-5" style={{ color: "var(--nb-poison)" }} aria-hidden />
            </span>
            <div>
              <p className="text-[0.95rem] font-black leading-tight" style={{ color: "var(--nb-bone)" }}>
                {t.lb.title}
              </p>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(242,237,228,.45)" }}>
                {t.lb.kicker} · winrate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="close leaderboard"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mt-5 text-center text-[0.78rem] font-bold" style={{ color: "var(--nb-blood)" }}>
            {t.bet.networkDown}
          </p>
        )}

        {!error && !data && (
          <div className="mt-6 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-xl"
                style={{ background: "rgba(242,237,228,.06)" }}
              />
            ))}
          </div>
        )}

        {data && rows.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 py-4 text-center">
            <Eye className="h-7 w-7" style={{ color: "rgba(242,237,228,.4)" }} aria-hidden />
            <p className="text-[0.85rem] font-extrabold" style={{ color: "var(--nb-bone)" }}>
              {t.lb.empty}
            </p>
            <p className="max-w-xs text-[0.72rem] font-semibold leading-relaxed" style={{ color: "rgba(242,237,228,.55)" }}>
              {t.lb.minBets}
            </p>
          </div>
        )}

        {me && !meInTop && rows.length > 0 && (
          <ol className="mt-4">
            <li
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{
                background: "rgba(200,255,0,.1)",
                border: "1px solid rgba(200,255,0,.35)",
              }}
            >
              <span className="w-7 shrink-0 text-center text-[0.85rem] font-black" style={{ color: "var(--nb-poison)" }}>
                {me.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.78rem] font-extrabold" style={{ color: "var(--nb-poison)" }}>
                {nameOf(me)}
              </span>
              <span className="shrink-0 text-[0.66rem] font-bold" style={{ color: "rgba(242,237,228,.45)" }}>
                {me.correct}/{me.bets}
              </span>
              <span className="w-12 shrink-0 text-right text-[0.85rem] font-black" style={{ color: "var(--nb-poison)" }}>
                {me.winrate}%
              </span>
            </li>
          </ol>
        )}

        {rows.length > 0 && (
          <ol className="mt-4 space-y-1.5">
            {rows.map((r) => {
              const isMe = me?.accountId === r.accountId;
              return (
                <li
                  key={r.accountId}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: isMe ? "rgba(200,255,0,.1)" : "rgba(242,237,228,.05)",
                    border: `1px solid ${isMe ? "rgba(200,255,0,.35)" : "rgba(242,237,228,.08)"}`,
                  }}
                >
                  <span
                    className="w-7 shrink-0 text-center text-[0.85rem] font-black"
                    style={{ color: r.rank === 1 ? "var(--nb-poison)" : "rgba(242,237,228,.6)" }}
                  >
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.78rem] font-extrabold" style={{ color: "var(--nb-bone)" }}>
                    {nameOf(r)}
                    {isMe && (
                      <span className="ml-1.5 text-[0.6rem] font-black uppercase tracking-[0.16em]" style={{ color: "var(--nb-poison)" }}>
                        {t.lb.you}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[0.66rem] font-bold" style={{ color: "rgba(242,237,228,.45)" }}>
                    {r.correct}/{r.bets}
                  </span>
                  <span
                    className="w-12 shrink-0 text-right text-[0.85rem] font-black"
                    style={{ color: r.winrate >= 60 ? "var(--nb-poison)" : "var(--nb-bone)" }}
                  >
                    {r.winrate}%
                  </span>
                  <span
                    className="w-16 shrink-0 text-right text-[0.66rem] font-black"
                    style={{ color: r.netCents > 0 ? "var(--nb-poison)" : "rgba(255,92,122,.8)" }}
                  >
                    {r.netCents > 0 ? "+" : ""}
                    {fmtUsd(r.netCents)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <Link
          href="/leaderboard"
          className="mt-4 block text-center text-[0.64rem] font-black uppercase tracking-[0.2em] transition-colors"
          style={{ color: "var(--nb-poison)" }}
        >
          {t.land.lb}
        </Link>
      </div>
    </div>
  );
}
