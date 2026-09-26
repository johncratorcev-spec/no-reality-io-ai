"use client";

import { useEffect, useState } from "react";

/* ================================================================
   PROFILE PANEL (/pnl): «share & earn».

   ОХВАТЫ УБРАНЫ (цифры просмотров/кликов — фейк-социальное давление).
   Вместо них — мотивация шеринга:
     - реферальные начисления (20% рейка приведённых глаз, 20% с продаж);
     - приглашение + нативный share (navigator.share → буфер);
     - бейджи и свободные бесплатные прогнозы.
   Читает GET /api/profile. Мобильный-first, единый тёмный стиль.
   ================================================================ */

interface ProfileData {
  wallet: string | null;
  email: string | null;
  refCode: string | null;
  inviteUrl: string | null;
  bonusCredits: number;
  badges: string[];
  referral: { eventsTotal: number; paidTotal: number; accruedUsdt: string };
  bonusesEnabled: boolean;
}

const BADGE_META: Record<string, { label: string; hint: string }> = {
  early: { label: "early creator", hint: "one of the first hundred members" },
  seer: { label: "seer", hint: "prediction streak — the future bends to you" },
};

function short(v: string): string {
  return v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;
}

export default function ProfilePanel() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready" | "down">("loading");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (stopped) return;
        if (r.status === 401) {
          setState("anon");
          return;
        }
        if (!r.ok) {
          setState("down");
          return;
        }
        setData((await r.json()) as ProfileData);
        setState("ready");
      } catch {
        if (!stopped) setState("down");
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  const shareInvite = async () => {
    if (!data?.inviteUrl) return;
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({
          title: "no reality.",
          text: "смотри то, чего не должно быть — и спорь на шов. 20% рейка приведённых глаз — твои.",
          url: data.inviteUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(data.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard запрещён / шоурил отменён */
    }
  };

  if (state === "loading" || state === "down") return null;

  if (state === "anon") {
    return (
      <div className="nrld-panel-blood mt-8 rounded-3xl px-6 py-8 text-center">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-[#ff4d6e]">
          share &amp; earn
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[0.8rem] font-semibold leading-relaxed text-white/55">
          connect a wallet — your invite link, referral payouts and badges all
          live here.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-8">
      <div className="nrld-rise mb-4 flex items-baseline gap-3">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-[#ff4d6e]">
          share &amp; earn
        </p>
        <span className="font-mono text-[0.6rem] font-bold text-white/40">
          {data.wallet ? short(data.wallet) : data.email}
        </span>
      </div>

      {/* реферальные деньги — единственные цифры, которые мотивируют */}
      <div className="nrld-rise-late grid grid-cols-2 gap-3">
        <div className="nrld-panel-blood rounded-2xl px-4 py-4 text-center">
          <p className="text-[0.56rem] font-extrabold uppercase tracking-[0.18em] text-white/45">
            referrals paid
          </p>
          <p className="nrld-num mt-1.5 text-[1.3rem] font-extrabold text-[#57d98a]">
            {data.referral.paidTotal}
          </p>
        </div>
        <div className="nrld-panel-blood rounded-2xl px-4 py-4 text-center">
          <p className="text-[0.56rem] font-extrabold uppercase tracking-[0.18em] text-white/45">
            accrued
          </p>
          <p className="nrld-num mt-1.5 text-[1.3rem] font-extrabold text-[#d9a441]">
            ${data.referral.accruedUsdt}
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-[0.7rem] font-semibold leading-relaxed text-white/55">
        20% of the rake from every eye you bring — forever. no caps, no
        spreadsheets: the ledger keeps the score.
      </p>

      {/* бейджи + бесплатные прогнозы */}
      <div className="nrld-rise-late2 mt-3 flex flex-wrap items-center justify-center gap-2">
        {data.badges.map((b) => {
          const meta = BADGE_META[b] ?? { label: b, hint: "" };
          return (
            <span
              key={b}
              title={meta.hint}
              className="nrld-stamp rounded-full px-3.5 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-[#ff4d6e]"
            >
              ◈ {meta.label}
            </span>
          );
        })}
        {data.bonusesEnabled && data.bonusCredits > 0 && (
          <span
            title="risk-free predictions — spend them on any market"
            className="nrld-stamp rounded-full px-3.5 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-[#d9a441]"
          >
            ❄ {data.bonusCredits} free prediction{data.bonusCredits > 1 ? "s" : ""}
          </span>
        )}
        {data.refCode && (
          <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-[0.62rem] font-extrabold text-white/60">
            {data.refCode}
          </span>
        )}
      </div>

      {/* приглашение: ссылка + нативный share */}
      {data.inviteUrl && (
        <div className="nrld-rise-late2 mt-3 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 font-mono text-[0.66rem] text-white/70">
            {data.inviteUrl}
          </code>
          <button
            onClick={() => void shareInvite()}
            className="nrld-btn-blood nrld-tap rounded-full px-5 py-2.5 text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-white"
          >
            {copied ? "copied ✓" : "share the seam"}
          </button>
        </div>
      )}
    </div>
  );
}
