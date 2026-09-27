"use client";

import { useLang } from "@/lib/i18n";

/**
 * RoadmapClient (v6) — bilingual карта дорожная внутренней экономики.
 *
 * Содержание привязано к инструкции: (4) мотивация вокруг внутреннего
 * баланса и пасс; (5) токен на Base + конвертация внутренней валюты
 * в реальные деньги + начисление за UTM-переходы.
 */

type Phase = {
  tag: string;
  title: string;
  items: string[];
  accent: "lime" | "bone" | "blood";
};

const CONTENT = {
  en: {
    kicker: "roadmap",
    title: "virtual coins today. real USDC on Base tomorrow.",
    sub: "Sign in with Google or nothing at all — 300 coins land on your balance the moment you join. Play on virtual coins now; at token generation every coin converts to its USDC equivalent on Base.",
    phases: [
      {
        tag: "now · live",
        title: "300 coins for everyone + instant accounts",
        accent: "lime" as const,
        items: [
          "sign in with Google — one tap, no forms — or stay guest: an account and 300 virtual coins appear automatically",
          "all predictions run on virtual coins — zero risk, pure eye vs machine",
          "earn coins: daily PASS bonus, targeted clicks, unique visitors on your UTM links, Instagram task (@mmayrday)",
          "NR PASS (free): link a wallet or Google account → daily bonus, streaks, higher earn caps",
          "coin multiplier packs: top up and get +10–25% bonus coins on bigger packs",
          "paid boosts stay strictly crypto — real USDT invoices via 2328.io",
        ],
      },
      {
        tag: "next",
        title: "seasons, prizes, creators",
        accent: "bone" as const,
        items: [
          "Best Eyes leaderboard seasons with prize pools in coins",
          "Daily Hard Mode tournaments — small entry, big pool",
          "creator boosts and featured slots paid from balance",
          "referral payouts switch from manual USDT to instant coin credit",
        ],
      },
      {
        tag: "base",
        title: "coins become real USDC on Base",
        accent: "blood" as const,
        items: [
          "$NR launches on Base (Coinbase L2) — fast, cheap, onchain",
          "every virtual coin becomes a REAL USDC EQUIVALENT on Base: 1 coin = 1 USDC at token generation — your play becomes withdrawable money",
          "$NR ↔ USDC: the internal currency converts 1:1 and becomes real money you can hold, move or cash out",
          "on-chain leaderboard and on-chain UTM rewards for creators",
          "contract address will be published here first — beware of fakes",
        ],
      },
    ],
    note: "dates move; direction doesn't. the coins you earn today are the USDC you withdraw tomorrow.",
  },
  ru: {
    kicker: "роадмап",
    title: "сегодня виртуальные монетки. завтра — реальные USDC на Base.",
    sub: "Вход по Google в один тап — или вообще без входа: 300 виртуальных монет появляются на балансе сразу после регистрации. Играй на виртуальные монеты сейчас — на генерации токена каждая монета конвертируется в свой USDC-эквивалент на Base.",
    phases: [
      {
        tag: "сейчас · в проде",
        title: "300 монет каждому + мгновенные аккаунты",
        accent: "lime" as const,
        items: [
          "вход по Google — один тап, без форм — или гость: аккаунт и 300 виртуальных монет появляются сами",
          "все предикты — на виртуальные монеты: ноль риска, чистый глаз против машины",
          "зарабатывай монеты: ежедневный PASS-бонус, целевые клики, уникальные переходы по твоим UTM-ссылкам, задание Instagram (@mmayrday)",
          "NR PASS (бесплатно): привяжи кошелёк или Google-аккаунт → дневной бонус, стрики, повышенные капсы",
          "пакеты с мультипликатором: пополняйся и получай +10–25% бонусных монет на больших пакетах",
          "платные бусты — строго крипта: реальные USDT-инвойсы через 2328.io",
        ],
      },
      {
        tag: "дальше",
        title: "сезоны, призы, авторы",
        accent: "bone" as const,
        items: [
          "сезоны Best Eyes leaderboard с призовыми пулами в монетах",
          "турниры Daily Hard Mode — маленький вход, большой банк",
          "бусты и фичеред-слоты авторов из баланса",
          "реферальные выплаты переходят с ручного USDT на мгновенное начисление монетами",
        ],
      },
      {
        tag: "base",
        title: "монетки станут реальными USDC на Base",
        accent: "blood" as const,
        items: [
          "$NR выходит на Base (L2 от Coinbase) — быстро, дёшево, ончейн",
          "каждая виртуальная монетка станет РЕАЛЬНЫМ USDC-ЭКВИВАЛЕНТОМ на Base: 1 монета = 1 USDC на генерации токена — наигранное превращается в выводимые деньги",
          "$NR ↔ USDC: внутренняя валюта конвертируется 1:1 и становится настоящими деньгами — можно держать, переводить и выводить",
          "ончейн-лидерборд и ончейн-награды за UTM для авторов",
          "адрес контракта опубликуем здесь первым — остерегайтесь подделок",
        ],
      },
    ],
    note: "даты двигаются — направление нет. монетки, наигранные сегодня, — это USDC, который ты выведешь завтра.",
  },
} as const;

const ACCENT = {
  lime: { color: "var(--nrld-lime, #c8ff00)", bg: "rgba(200,255,0,.08)", border: "rgba(200,255,0,.3)" },
  bone: { color: "#f2ede4", bg: "rgba(242,237,228,.06)", border: "rgba(242,237,228,.22)" },
  blood: { color: "#ff003c", bg: "rgba(255,0,60,.08)", border: "rgba(255,0,60,.32)" },
} as const;

export default function RoadmapClient() {
  const { lang } = useLang();
  const t = CONTENT[lang === "ru" ? "ru" : "en"];

  return (
    <div className="mx-auto max-w-3xl">
      <p
        className="text-[0.6rem] font-black uppercase tracking-[0.3em]"
        style={{ color: "rgba(242,237,228,.45)" }}
      >
        {t.kicker}
      </p>
      <h1
        className="mt-3 text-[1.7rem] font-black leading-[1.08] sm:text-[2.3rem]"
        style={{ color: "#f2ede4" }}
      >
        {t.title}
      </h1>
      <p
        className="mt-4 max-w-xl text-[0.92rem] font-medium leading-relaxed"
        style={{ color: "rgba(242,237,228,.66)" }}
      >
        {t.sub}
      </p>

      <div className="mt-10 flex flex-col gap-4">
        {t.phases.map((phase, i) => {
          const a = ACCENT[phase.accent];
          return (
            <article
              key={phase.tag}
              className="rounded-3xl p-5 sm:p-7"
              style={{ background: a.bg, border: `1px solid ${a.border}` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-black"
                  style={{ background: a.color, color: "#0a080d" }}
                >
                  {i + 1}
                </span>
                <span
                  className="text-[0.58rem] font-black uppercase tracking-[0.24em]"
                  style={{ color: a.color }}
                >
                  {phase.tag}
                </span>
              </div>
              <h2
                className="mt-3 text-[1.15rem] font-black leading-snug sm:text-[1.35rem]"
                style={{ color: "#f2ede4" }}
              >
                {phase.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {phase.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-[0.86rem] font-medium leading-relaxed"
                    style={{ color: "rgba(242,237,228,.78)" }}
                  >
                    <span aria-hidden className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p
        className="mt-8 text-center text-[0.72rem] font-bold tracking-wide"
        style={{ color: "rgba(242,237,228,.42)" }}
      >
        {t.note}
      </p>
    </div>
  );
}
