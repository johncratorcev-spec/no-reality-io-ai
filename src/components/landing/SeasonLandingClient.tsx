"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";

/**
 * v13 — клиентская часть лендинга кампании: полный i18n (ru/en),
 * дерзкий тон, ноль кураторской лексики. Данные сезона приходят
 * с сервера (SeasonLanding — server shell).
 */
export default function SeasonLandingClient({
  snapshotLabel,
  hasSeason,
  dayOf,
}: {
  snapshotLabel: string;
  hasSeason: boolean;
  dayOf: number;
}) {
  const { t } = useLang();
  const snapshotLine = hasSeason
    ? t.land.snapshotOn.replace("{d}", snapshotLabel)
    : t.land.snapshotIn;

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-14">
      {/* ---------- Season 1 live ---------- */}
      <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(200,255,0,0.35)] bg-[rgba(200,255,0,0.08)] px-3.5 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.22em] text-[#c8ff00]">
        <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#c8ff00]" />
        {t.land.pill}
      </p>

      <h1 className="mt-6 text-[2.6rem] font-black leading-[0.98] tracking-tight text-[#f2ede4] sm:text-6xl">
        {t.land.h1a}
        <br />
        {t.land.h1b}
        <span className="text-[#FF003C]">.</span>
      </h1>

      {/* ---------- 8 строк продукта ---------- */}
      <ol className="mt-7 space-y-2.5 text-[0.92rem] font-semibold leading-relaxed text-[#f2ede4]/70">
        {t.land.lines.map((line, i) => (
          <li key={i}>
            <span className="mr-2 text-[#c8ff00]">{String(i + 1).padStart(2, "0")}</span>
            {line}
          </li>
        ))}
      </ol>

      {/* ---------- CTA ---------- */}
      <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Link
          href="/bet"
          className="group inline-flex items-center gap-2.5 rounded-full bg-[#c8ff00] px-7 py-3.5 text-[0.95rem] font-black tracking-tight text-[#0B0910] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_28px_rgba(200,255,0,0.35)] active:scale-95"
        >
          {t.land.cta}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-[0.8rem] font-extrabold text-white/70 transition-colors hover:border-white/35 hover:text-white"
        >
          {t.land.cta2}
        </Link>
      </div>

      {/* ---------- лидерборд + дата среза ---------- */}
      <div className="mt-6 flex flex-col gap-1.5">
        <Link
          href="/leaderboard"
          className="w-fit text-[0.72rem] font-black uppercase tracking-[0.18em] text-[#c8ff00]/80 transition-colors hover:text-[#c8ff00]"
        >
          {t.land.lb}
        </Link>
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-white/35">
          {snapshotLine} ·{" "}
          {dayOf > 0 && dayOf <= 7 ? t.land.dayOf.replace("{n}", String(dayOf)) : t.land.finalDay}
        </p>
      </div>
    </main>
  );
}
