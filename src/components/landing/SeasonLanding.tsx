import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { seasonInfo } from "@/lib/season";

/**
 * v11 — ЛЕНДИНГ КАМПАНИИ (приказ: «лендинг сегодня: 8 строк + кнопка
 * Call it + Season 1 live. Не манифест про ворон»).
 *
 * Старый карнавал-манифест (Landing.tsx, 734 строки) заморожен — не
 * удаляем, просто больше не рендерим. Здесь только суть продукта:
 * что это, как играть, когда снапшот, и одна кнопка в игру.
 * Серверный компонент: дата среза приходит из БД (Season s1).
 */

export default async function SeasonLanding() {
  const season = await seasonInfo();
  const daysLeft = season?.daysLeft ?? 7;
  const snapshotLine = season
    ? `snapshot on ${season.snapshotLabel}`
    : "snapshot in 7 days";

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0910]">
      <Header />

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-14">
        {/* ---------- Season 1 live ---------- */}
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(200,255,0,0.35)] bg-[rgba(200,255,0,0.08)] px-3.5 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.22em] text-[#c8ff00]">
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#c8ff00]" />
          Season 1 live
        </p>

        <h1 className="mt-6 text-[2.6rem] font-black leading-[0.98] tracking-tight text-[#f2ede4] sm:text-6xl">
          real or
          <br />
          synth<span className="text-[#FF003C]">.</span>
        </h1>

        {/* ---------- 8 строк продукта ---------- */}
        <ol className="mt-7 space-y-2.5 text-[0.92rem] font-semibold leading-relaxed text-[#f2ede4]/70">
          <li><span className="mr-2 text-[#c8ff00]">01</span>watch a clip — real footage or a machine dream, no titles, no hints.</li>
          <li><span className="mr-2 text-[#c8ff00]">02</span>call it: REAL or SYNTH.</li>
          <li><span className="mr-2 text-[#c8ff00]">03</span>stake 10, 25 or 50 EYE into the pari-mutuel bank.</li>
          <li><span className="mr-2 text-[#c8ff00]">04</span>the curator&apos;s verdict closes the round in under a minute.</li>
          <li><span className="mr-2 text-[#c8ff00]">05</span>winners split the losing side&apos;s bank — straight to your ledger.</li>
          <li><span className="mr-2 text-[#c8ff00]">06</span>sign in with telegram — get 100 EYE once, no wallet needed.</li>
          <li><span className="mr-2 text-[#c8ff00]">07</span>EYE are game points. never for sale.</li>
          <li><span className="mr-2 text-[#c8ff00]">08</span>day 7, 12:00 UTC — season snapshot. token claim on Base after it.</li>
        </ol>

        {/* ---------- CTA ---------- */}
        <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link
            href="/bet"
            className="group inline-flex items-center gap-2.5 rounded-full bg-[#c8ff00] px-7 py-3.5 text-[0.95rem] font-black tracking-tight text-[#0B0910] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_28px_rgba(200,255,0,0.35)] active:scale-95"
          >
            call it
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-[0.8rem] font-extrabold text-white/70 transition-colors hover:border-white/35 hover:text-white"
          >
            just watch the feed
          </Link>
        </div>

        {/* ---------- дата среза ---------- */}
        <p className="mt-6 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-white/35">
          {snapshotLine} · {daysLeft > 0 ? `day ${8 - daysLeft} of 7` : "final day"}
        </p>
      </main>

      <Footer />
    </div>
  );
}
