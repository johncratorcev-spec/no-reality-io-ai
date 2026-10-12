"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Flame, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { FEATURES } from "@/lib/features";

/* ================================================================
   BoostClient — форма буста на /boost (v5).
   Код клипа (utm_code из ленты) + срок 1/3/7 дней → POST
   /api/boost/checkout → hosted checkout 2328.io → возврат на
   /boost?code=…&paid=1 → поллинг статуса инвойса → «буст живёт».
   ================================================================ */

const DAYS = [1, 3, 7] as const;
const PRICE_PER_DAY = 3; // $3/день — зеркалит boostPricePerDayUsdt() дефолт
const POLL_MS = 3000;
const POLL_MAX = 60;

type Phase = "idle" | "invoicing" | "awaiting" | "paid" | "failed";

export default function BoostClient() {
  const [code, setCode] = useState("");
  const [days, setDays] = useState<(typeof DAYS)[number]>(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const polls = useRef(0);

  /* возврат с чекаута: /boost?code=…&paid=1 — подхватываем инвойс */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("code");
      if (c) setCode(c);
      if (sp.get("paid") === "1" && c) {
        setPhase("awaiting");
        polls.current = 0;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const pollStatus = useCallback(async (clip: string) => {
    polls.current++;
    if (polls.current > POLL_MAX) {
      setPhase("failed");
      setError("инвойс так и не подтвердился — напиши нам в telegram");
      return;
    }
    try {
      /* статус буста узнаём честно: заказ подтверждает только webhook,
         поэтому поллим Ranking-API по признаку featured на клипе */
      const r = await fetch(`/api/boost/status?code=${encodeURIComponent(clip)}`, {
        cache: "no-store",
      });
      const d = (await r.json()) as { active?: boolean; paidUntil?: string | null };
      if (d.active) {
        setPaidUntil(d.paidUntil ?? null);
        setPhase("paid");
        return;
      }
    } catch {
      /* сеть — попробуем на следующем тике */
    }
    setTimeout(() => void pollStatus(clip), POLL_MS);
  }, []);

  useEffect(() => {
    if (phase !== "awaiting" || !code) return;
    void pollStatus(code);
  }, [phase, code, pollStatus]);

  const buy = async () => {
    setError(null);
    setPhase("invoicing");
    try {
      const r = await fetch("/api/boost/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), days }),
      });
      const d = (await r.json()) as { payUrl?: string; error?: string };
      if (!r.ok || !d.payUrl) throw new Error(d.error || "checkout failed");
      setPayUrl(d.payUrl);
      setPhase("awaiting");
      polls.current = 0;
      window.location.href = d.payUrl; // hosted checkout 2328.io
    } catch (e) {
      setError(e instanceof Error ? e.message : "checkout failed");
      setPhase("idle");
    }
  };

  const price = PRICE_PER_DAY * days;

  return (
    <section className="mx-auto max-w-3xl px-5 pb-24">
      <div className="rounded-3xl border border-white/10 bg-[rgba(16,13,22,0.72)] p-6 backdrop-blur-md sm:p-10">
        {phase === "paid" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "rgba(200,255,0,.12)", border: "1px solid rgba(200,255,0,.4)" }}
            >
              <Check className="h-8 w-8 text-[#C8FF00]" aria-hidden />
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">буст живёт</h2>
            <p className="max-w-md text-[0.85rem] font-semibold leading-relaxed text-white/60">
              клип{" "}
              <code className="font-mono text-[#C8FF00]">{code}</code> стоит в топу
              предикшен-ленты с чипом FEATURED
              {paidUntil ? ` до ${new Date(paidUntil).toLocaleString("ru-RU")}` : ""}
              . Смотри аналитику ставок в /pnl.
            </p>
            <a
              href={`/v/${encodeURIComponent(code)}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[0.8rem] font-extrabold text-[#0A0A0F] transition-transform duration-300 hover:scale-[1.04]"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              открыть клип в ленте
            </a>
          </div>
        ) : phase === "awaiting" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#FF5C7A]" aria-hidden />
            <p className="text-[0.95rem] font-extrabold text-white">
              ждём подтверждение инвойса…
            </p>
            <p className="max-w-sm text-[0.72rem] font-semibold leading-relaxed text-white/50">
              как только 2328 подтвердит оплату подписанным webhook&apos;ом,
              буст стартует автоматически — страница обновится сама
            </p>
            {payUrl && (
              <a
                href={payUrl}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[0.72rem] font-extrabold text-white/85 transition-colors hover:bg-white/10"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                reopen checkout
              </a>
            )}
          </div>
        ) : (
          <>
            {!FEATURES.payments ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">
                  no-reality<span style={{ color: "var(--nb-blood)" }}>.</span>
                </p>
                <h2 className="text-xl font-extrabold tracking-tight text-white">
                  платные бусты на паузе
                </h2>
                <p className="max-w-md text-[0.82rem] font-semibold leading-relaxed text-white/55">
                  Season 1 — очковая экономика: EYE не продаются, инвойсы
                  вернутся после снапшота (дата — на главной).
                </p>
                <a
                  href="/bet"
                  className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[0.8rem] font-extrabold text-[#0A0A0F] transition-transform duration-300 hover:scale-[1.04]"
                >
                  играть в Season 1 →
                </a>
              </div>
            ) : (
              <>
            {/* поле: код клипа */}
            <label
              htmlFor="boost-code"
              className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45"
            >
              код клипа (utm_code из ленты)
            </label>
            <input
              id="boost-code"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="напр. 71vsIPUu"
              maxLength={16}
              className="mt-2 w-full rounded-2xl border border-white/12 bg-[rgba(10,10,15,0.7)] px-4 py-3.5 font-mono text-[0.95rem] font-bold text-white placeholder:text-white/25 focus:border-[#C8FF00]/50 focus:outline-none"
            />
            <p className="mt-2 text-[0.64rem] font-semibold text-white/35">
              код есть в адресе любого клипа: no-reality.fun/v/
              <span className="text-white/60">КОД</span> — открой свой клип и скопируй
            </p>

            {/* срок */}
            <p className="mt-7 text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">
              срок
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className="rounded-2xl border px-3 py-3.5 text-center transition-transform duration-200 hover:scale-[1.03] active:scale-95"
                  style={{
                    borderColor: days === d ? "rgba(200,255,0,.5)" : "rgba(242,237,228,.12)",
                    background: days === d ? "rgba(200,255,0,.1)" : "rgba(10,10,15,0.6)",
                  }}
                  aria-pressed={days === d}
                >
                  <span
                    className="block text-[0.95rem] font-black"
                    style={{ color: days === d ? "var(--nb-poison)" : "rgba(242,237,228,.75)" }}
                  >
                    {d} {d === 1 ? "день" : "дня"}
                  </span>
                  <span className="mt-0.5 block text-[0.62rem] font-bold text-white/40">
                    ${PRICE_PER_DAY * d}
                  </span>
                </button>
              ))}
            </div>

            {/* что входит */}
            <ul className="mt-7 space-y-2">
              {[
                "первый экран ленты /bet, пока идёт буст",
                "чип FEATURED на карточке клипа",
                "аналитика ставок клипа — в /pnl",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-[0.78rem] font-semibold text-white/65">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8FF00]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>

            <button
              onClick={buy}
              disabled={phase === "invoicing" || code.trim().length < 4}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF003C] px-7 py-4 text-[0.9rem] font-black text-white transition-transform duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {phase === "invoicing" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Flame className="h-4 w-4" aria-hidden />
              )}
              {phase === "invoicing" ? "открываем чекаут…" : `boost · ${days} ${days === 1 ? "день" : "дня"} · $${price}`}
            </button>
            <p className="mt-2.5 text-center text-[0.62rem] font-semibold text-white/35">
              крипто-инвойс 2328.io · USDT · старт сразу после подтверждения
            </p>

            {error && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#FF003C]/12 px-3 py-2 text-[0.7rem] font-semibold leading-snug text-[#FF5C7A]">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
