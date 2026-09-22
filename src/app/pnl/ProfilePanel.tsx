"use client";

import { useEffect, useState } from "react";

/* ================================================================
   PROFILE PANEL (/pnl, task 44 §4+§5): «your reach».

   Читает GET /api/profile и показывает в одном блоке:
     - бейджи (early / seer) и свободные бесплатные прогнозы;
     - охват персональных ссылок: total / unique переходы
       + разбивка по типам объектов (video / market / banner / prompt);
     - реферальные начисления (checkout/paid/USDT) + invite link.
   Мобильный-first: стек карточек, крупный шрифт цифр, без таблиц.
   ================================================================ */

interface ProfileData {
  wallet: string | null;
  email: string | null;
  refCode: string | null;
  inviteUrl: string | null;
  bonusCredits: number;
  badges: string[];
  reach: {
    total: number;
    unique: number;
    byType: { type: string; total: number; unique: number }[];
  };
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

  const copyInvite = async () => {
    if (!data?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(data.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard запрещён */
    }
  };

  if (state === "loading" || state === "down") return null;

  if (state === "anon") {
    return (
      <div className="nr-glass-deep mt-8 rounded-3xl px-6 py-8 text-center">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-[#6d4fc2]">
          your reach
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[0.8rem] font-semibold leading-relaxed text-[#10161d]/55">
          connect a wallet — personal links, click stats, free predictions
          and badges all live here.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-baseline gap-3">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-[#6d4fc2]">
          your reach
        </p>
        <span className="font-mono text-[0.6rem] font-bold text-[#10161d]/40">
          {data.wallet ? short(data.wallet) : data.email}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "clicks total", v: String(data.reach.total), c: "#10161d" },
          { k: "unique visitors", v: String(data.reach.unique), c: "#2b6cb0" },
          { k: "referrals paid", v: String(data.referral.paidTotal), c: "#1d7a3e" },
          { k: "accrued", v: `$${data.referral.accruedUsdt}`, c: "#b8860b" },
        ].map((x) => (
          <div
            key={x.k}
            className="nr-glass-deep rounded-2xl px-4 py-4 text-center"
          >
            <p className="text-[0.56rem] font-extrabold uppercase tracking-[0.18em] text-[#10161d]/45">
              {x.k}
            </p>
            <p
              className="mt-1.5 font-mono text-[1.05rem] font-extrabold"
              style={{ color: x.c }}
            >
              {x.v}
            </p>
          </div>
        ))}
      </div>

      {/* разбивка по типам объектов */}
      {data.reach.byType.length > 0 && (
        <div className="nr-glass-deep mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl px-5 py-3">
          {data.reach.byType.map((t) => (
            <span
              key={t.type}
              className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-[#10161d]/55"
            >
              {t.type} <b className="font-mono text-[#10161d]">{t.total}</b>
              <span className="text-[#10161d]/40"> · {t.unique} uniq</span>
            </span>
          ))}
        </div>
      )}

      {/* бейджи + бесплатные прогнозы */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {data.badges.map((b) => {
          const meta = BADGE_META[b] ?? { label: b, hint: "" };
          return (
            <span
              key={b}
              title={meta.hint}
              className="nr-glass rounded-full px-3.5 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-[#6d4fc2]"
            >
              ◈ {meta.label}
            </span>
          );
        })}
        {data.bonusesEnabled && data.bonusCredits > 0 && (
          <span
            title="risk-free predictions — spend them on any market"
            className="nr-glass rounded-full px-3.5 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-[#c2410c]"
          >
            ❄ {data.bonusCredits} free prediction{data.bonusCredits > 1 ? "s" : ""}
          </span>
        )}
        {data.refCode && (
          <span className="nr-glass rounded-full px-3.5 py-1.5 font-mono text-[0.62rem] font-extrabold text-[#10161d]/60">
            {data.refCode}
          </span>
        )}
      </div>

      {/* invite link */}
      {data.inviteUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-[#10161d]/5 px-3.5 py-2.5 font-mono text-[0.66rem] text-[#10161d]/70">
            {data.inviteUrl}
          </code>
          <button
            onClick={copyInvite}
            className="rounded-full bg-[#10161d]/5 px-4 py-2 text-[0.66rem] font-extrabold text-[#10161d] ring-1 ring-[#10161d]/15 transition-colors hover:bg-[#10161d]/10"
          >
            {copied ? "copied ✓" : "copy invite"}
          </button>
        </div>
      )}
    </div>
  );
}
