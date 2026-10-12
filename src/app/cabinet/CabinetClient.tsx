"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Check,
  Copy,
  Gift,
  Loader2,
  LogIn,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { storeMyRef } from "@/lib/shareRef";

/* ================================================================
   Кабинет игрока (v20, ТЗ §6–§7): баланс EYE с честной пометкой
   «только для игры», PnL день/сезон, winrate, стрики (входов + верных),
   бейджи, статистика рефералов, фрибет за @username, шоп EYE.
   Данные — один GET /api/me/summary; действия — /api/me/daily,
   /api/freebet/telegram, /api/shop/buy. Мобильный-first.
   ================================================================ */

interface Summary {
  account: {
    accountId: string;
    balanceCents: number;
    isPass: boolean;
    email: string | null;
    name: string | null;
    streakDays: number;
    dailyAvailable: boolean;
  };
  pnl: {
    day: { stakeCents: number; payoutCents: number; bonusCents: number };
    season: { stakeCents: number; payoutCents: number; bonusCents: number };
  };
  winStats: { won: number; lost: number; total: number; winrate: number };
  referrals: { invited: number; activated: number; eyeFromRefs: number; refCode: string | null; link: string | null };
  streak: { streakDays: number; shieldActive: boolean; dailyStreak: number };
  shares: { win: boolean; streak: boolean };
  badges: Array<{ code: string; label: string; hint: string; icon: string; awardedAt: string }>;
  freebet: { username: string; amountCents: number } | null;
  shop: { owned: string[] };
  winStreak: number;
}

const fmtEYE = (c: number) => (c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
const pnlOf = (b: { stakeCents: number; payoutCents: number; bonusCents: number }) =>
  b.payoutCents - b.stakeCents + b.bonusCents;

export default function CabinetClient() {
  const { t, lang } = useLang();
  const [data, setData] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready" | "down">("loading");
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [tgNick, setTgNick] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    void (async () => {
      try {
        const r = await fetch("/api/me/summary", { cache: "no-store" });
        if (r.status === 401) {
          setState("anon");
          return;
        }
        if (!r.ok) {
          setState("down");
          return;
        }
        setData((await r.json()) as Summary);
        setState("ready");
      } catch {
        setState("down");
      }
    })();
  }, []);

  useEffect(load, [load]);

  /* v20: свой реф-код — в localStorage (все share-кнопки подхватят через withRef) */
  useEffect(() => {
    if (data?.referrals?.refCode) storeMyRef(data.referrals.refCode);
  }, [data?.referrals?.refCode]);

  const claimDaily = async () => {
    setBusy("daily");
    setMsg("");
    try {
      const r = await fetch("/api/me/daily", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { credited?: boolean; error?: string };
      if (d.credited) setMsg(lang === "ru" ? "+50 EYE — стрик растёт" : "+50 EYE — streak grows");
      else setMsg(d.error === "pass_required" ? (lang === "ru" ? "нужен вход" : "sign in required") : "");
      load();
    } finally {
      setBusy("");
    }
  };

  const claimFreebet = async () => {
    setBusy("freebet");
    setMsg("");
    try {
      const r = await fetch("/api/freebet/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: tgNick }),
      });
      const d = (await r.json().catch(() => ({}))) as { granted?: boolean; reason?: string; error?: string };
      if (d.granted) setMsg(lang === "ru" ? "фрибет получен" : "freebet claimed");
      else if (d.reason === "username_taken") setMsg(lang === "ru" ? "этот ник уже забрал фрибет" : "this nick already claimed");
      else if (d.reason === "already_claimed") setMsg(lang === "ru" ? "у тебя уже есть фрибет" : "you already claimed");
      else if (d.error === "bad_username") setMsg(lang === "ru" ? "ник выглядит неверным" : "that nick looks wrong");
      load();
    } finally {
      setBusy("");
    }
  };

  const buy = async (sku: string) => {
    setBusy(sku);
    setMsg("");
    try {
      const r = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      const d = (await r.json().catch(() => ({}))) as { bought?: boolean; error?: string };
      if (d.bought) setMsg(lang === "ru" ? "куплено" : "bought");
      else if (d.error === "insufficient_balance") setMsg(lang === "ru" ? "не хватает EYE" : "not enough EYE");
      load();
    } finally {
      setBusy("");
    }
  };

  /* ---------- состояния ---------- */
  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" aria-hidden />
      </div>
    );
  }
  if (state === "anon" || state === "down") {
    return (
      <div className="nrld-panel-blood rounded-3xl px-6 py-10 text-center">
        <p className="text-[0.95rem] font-extrabold text-white">{t.cab.signin}</p>
        <Link
          href="/auth?next=/cabinet"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#FF003C] px-6 py-3 text-[0.8rem] font-black text-white transition-transform hover:scale-[1.03]"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          {lang === "ru" ? "вход — 15 секунд" : "sign in — 15 seconds"}
        </Link>
      </div>
    );
  }
  if (!data) return null;

  const ru = lang === "ru";

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- баланс EYE ---------- */}
      <section className="nrld-panel-blood rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#ff4d6e]">
              {t.cab.balance}
            </p>
            <p className="mt-1.5 text-5xl font-black leading-none tracking-tight text-white">
              {fmtEYE(data.account.balanceCents)}
              <span className="ml-2 text-base font-extrabold text-white/40">EYE</span>
            </p>
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#C8FF00]/30 bg-[#C8FF00]/10 px-3 py-1 text-[0.6rem] font-black uppercase tracking-[0.12em] text-[#C8FF00]">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {t.cab.playOnly}
            </p>
          </div>
          <div className="text-right">
            {data.account.dailyAvailable ? (
              <button
                onClick={() => void claimDaily()}
                disabled={busy === "daily"}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#C8FF00] px-4 py-2.5 text-[0.68rem] font-black text-[#0a0a0a] transition-transform hover:scale-[1.04] active:scale-95 disabled:opacity-50"
              >
                {busy === "daily" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Gift className="h-3.5 w-3.5" aria-hidden />}
                {t.cab.dailyClaim}
              </button>
            ) : (
              <span className="inline-block rounded-full border border-white/10 px-3.5 py-2 text-[0.6rem] font-bold text-white/40">
                {t.cab.dailyClaimed}
              </span>
            )}
            <p className="mt-2 text-[0.62rem] font-bold text-white/45">
              {t.cab.streak}: <span className="text-white">{data.streak.streakDays}</span>
              {data.streak.shieldActive && (
                <span className="ml-1.5 rounded-full bg-[#C8FF00]/15 px-1.5 py-0.5 text-[0.55rem] font-black text-[#C8FF00]">
                  {t.cab.shieldOn}
                </span>
              )}
            </p>
          </div>
        </div>
        {msg && <p className="mt-3 text-[0.68rem] font-bold text-[#C8FF00]">{msg}</p>}
      </section>

      {/* ---------- PnL ---------- */}
      <section className="grid grid-cols-2 gap-4">
        {(["day", "season"] as const).map((k) => {
          const b = data.pnl[k];
          const pnl = pnlOf(b);
          return (
            <div key={k} className="nrld-panel-blood rounded-3xl p-5">
              <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.2em] text-white/40">
                {k === "day" ? t.cab.pnlDay : t.cab.pnlSeason}
              </p>
              <p
                className="mt-1.5 text-2xl font-black tracking-tight"
                style={{ color: pnl >= 0 ? "#C8FF00" : "#FF4D6E" }}
              >
                {pnl >= 0 ? "+" : ""}
                {fmtEYE(pnl)}
              </p>
              <dl className="mt-2 space-y-0.5 text-[0.62rem] font-semibold text-white/45">
                <div className="flex justify-between gap-2"><dt>{t.cab.staked}</dt><dd>{fmtEYE(b.stakeCents)}</dd></div>
                <div className="flex justify-between gap-2"><dt>{t.cab.won2}</dt><dd>{fmtEYE(b.payoutCents)}</dd></div>
                <div className="flex justify-between gap-2"><dt>{t.cab.bonuses}</dt><dd>{fmtEYE(b.bonusCents)}</dd></div>
              </dl>
            </div>
          );
        })}
      </section>

      <section className="nrld-panel-blood grid grid-cols-3 gap-3 rounded-3xl p-5 text-center">
        <div>
          <p className="text-[0.55rem] font-extrabold uppercase tracking-[0.16em] text-white/40">{t.cab.winrate}</p>
          <p className="mt-1 text-xl font-black text-white">{data.winStats.winrate}%</p>
          <p className="text-[0.58rem] text-white/35">{data.winStats.won}/{data.winStats.total}</p>
        </div>
        <div>
          <p className="text-[0.55rem] font-extrabold uppercase tracking-[0.16em] text-white/40">{t.cab.winStreak}</p>
          <p className="mt-1 text-xl font-black text-white">{data.winStreak}</p>
        </div>
        <div>
          <p className="text-[0.55rem] font-extrabold uppercase tracking-[0.16em] text-white/40">{t.cab.streak}</p>
          <p className="mt-1 text-xl font-black text-white">{data.streak.dailyStreak}</p>
        </div>
      </section>

      {/* ---------- бейджи ---------- */}
      <section className="nrld-panel-blood rounded-3xl p-6">
        <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#ff4d6e]">
          {t.cab.badges}
        </p>
        {data.badges.length === 0 ? (
          <p className="mt-3 text-[0.75rem] font-semibold text-white/45">{t.cab.badgesEmpty}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {data.badges.map((b) => (
              <li
                key={b.code}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                title={b.hint}
              >
                <span aria-hidden className="text-lg">{b.icon}</span>
                <p className="mt-0.5 flex items-center gap-1 text-[0.7rem] font-extrabold text-white">
                  {b.label}
                  <BadgeCheck className="h-3 w-3 text-[#C8FF00]" aria-hidden />
                </p>
                <p className="text-[0.56rem] font-semibold leading-snug text-white/40">{b.hint}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- рефералы ---------- */}
      <section className="nrld-panel-blood rounded-3xl p-6">
        <p className="flex items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#ff4d6e]">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {t.cab.refs}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/[0.04] px-2 py-3">
            <p className="text-lg font-black text-white">{data.referrals.invited}</p>
            <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-white/40">{t.cab.invited}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] px-2 py-3">
            <p className="text-lg font-black text-white">{data.referrals.activated}</p>
            <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-white/40">{t.cab.activated}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] px-2 py-3">
            <p className="text-lg font-black text-[#C8FF00]">{fmtEYE(data.referrals.eyeFromRefs)}</p>
            <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-white/40">{t.cab.fromRefs}</p>
          </div>
        </div>
        {data.referrals.link && (
          <div className="mt-4">
            <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.18em] text-white/35">{t.cab.invite}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[0.68rem] font-bold text-[#a8cfea]">
                {data.referrals.link}
              </code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(data.referrals.link!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  } catch { /* clipboard запрещён */ }
                }}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#C8FF00] px-3.5 text-[0.64rem] font-black text-[#0a0a0a] transition-transform hover:scale-[1.04] active:scale-95"
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? t.cab.copied : t.cab.copy}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- фрибет за Telegram-ник ---------- */}
      {!data.freebet && (
        <section className="nrld-panel-blood rounded-3xl p-6">
          <p className="flex items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#ff4d6e]">
            <Gift className="h-3.5 w-3.5" aria-hidden />
            {t.cab.freebet}
          </p>
          <p className="mt-2 text-[0.7rem] font-semibold text-white/50">{t.cab.freebetHint}</p>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={tgNick}
              onChange={(e) => setTgNick(e.target.value)}
              placeholder="@username"
              inputMode="text"
              maxLength={33}
              className="min-w-0 flex-1 rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[0.78rem] font-bold text-white placeholder:text-white/25 focus:border-[#a8cfea]/60 focus:outline-none"
            />
            <button
              onClick={() => void claimFreebet()}
              disabled={busy === "freebet" || !tgNick.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#FF003C] px-4 text-[0.64rem] font-black text-white transition-transform hover:scale-[1.04] active:scale-95 disabled:opacity-50"
            >
              {busy === "freebet" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {t.cab.freebetCta}
            </button>
          </div>
        </section>
      )}
      {data.freebet && (
        <section className="nrld-panel-blood flex items-center justify-between rounded-3xl p-5">
          <p className="text-[0.7rem] font-bold text-white/60">
            {t.cab.freebetDone.replace("{u}", data.freebet.username)}
          </p>
          <p className="text-[0.78rem] font-black text-[#C8FF00]">+{fmtEYE(data.freebet.amountCents)} EYE</p>
        </section>
      )}

      {/* ---------- шоп EYE ---------- */}
      <section className="nrld-panel-blood rounded-3xl p-6">
        <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#ff4d6e]">
          {t.cab.shop}
        </p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            {
              sku: "badge:pumpkin",
              icon: "🎃",
              label: t.cab.shopPumpkin,
              price: 75,
              owned: data.shop.owned.includes("badge:pumpkin"),
              hint: "",
            },
            {
              sku: "streak_shield",
              icon: "🛡",
              label: t.cab.shopShield,
              price: 120,
              owned: data.shop.owned.includes("streak_shield"),
              hint: t.cab.shieldHint,
            },
          ].map((it) => (
            <li
              key={it.sku}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
            >
              <span aria-hidden className="text-xl">{it.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.74rem] font-extrabold text-white">{it.label}</p>
                {it.hint && <p className="text-[0.58rem] font-semibold text-white/40">{it.hint}</p>}
              </div>
              {it.owned ? (
                <span className="rounded-full bg-[#C8FF00]/15 px-3 py-1.5 text-[0.6rem] font-black text-[#C8FF00]">
                  {t.cab.owned}
                </span>
              ) : (
                <button
                  onClick={() => void buy(it.sku)}
                  disabled={busy === it.sku}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#C8FF00]/40 bg-[#C8FF00]/10 px-3.5 py-2 text-[0.62rem] font-black text-[#C8FF00] transition-transform hover:scale-[1.05] active:scale-95 disabled:opacity-50"
                >
                  {busy === it.sku ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                  {t.cab.buy} · {it.price} EYE
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.6rem] font-semibold leading-relaxed text-white/35">
          {t.cab.snapshotNote}
        </p>
      </section>

      <Link
        href="/pnl"
        className="nb-btn nb-btn-real mx-auto rounded-full px-5 py-2.5 text-[0.72rem] font-bold"
      >
        {t.cab.positions}
      </Link>
    </div>
  );
}
