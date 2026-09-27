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
    title: "internal balance is the engine. base is the destination.",
    sub: "No forms. No email walls. You land, you play, the balance grows — and when the token lands, the balance becomes real money.",
    phases: [
      {
        tag: "now · live",
        title: "instant accounts + internal balance",
        accent: "lime" as const,
        items: [
          "zero-threshold entry: an account and a welcome balance appear the moment you first play — no wallet, no forms",
          "internal currency powers everything: predictions, rewards, seasons",
          "earn for targeted clicks on special blocks in the feed",
          "earn for every unique visitor on your UTM links — sharing is a payout",
          "NR PASS (free): link a wallet once → daily balance bonus, streaks, higher earn caps",
          "top-ups in crypto only — USDT via 2328.io",
        ],
      },
      {
        tag: "next",
        title: "seasons, prizes, creators",
        accent: "bone" as const,
        items: [
          "Best Eyes leaderboard seasons with prize pools from the internal currency",
          "Daily Hard Mode tournaments — small entry, big pool",
          "creator boosts and featured slots paid from balance",
          "referral payouts switch from manual USDT to instant balance credit",
        ],
      },
      {
        tag: "base",
        title: "$NR token on Base",
        accent: "blood" as const,
        items: [
          "$NR launches on Base (Coinbase L2) — fast, cheap, onchain",
          "internal balance converts to $NR 1:1 at token generation — your play becomes your bag",
          "$NR ↔ USDC: internal currency becomes withdrawable real money",
          "on-chain leaderboard and on-chain UTM rewards for creators",
          "contract address will be published here first — beware of fakes",
        ],
      },
    ],
    note: "dates move; direction doesn't. the balance you earn today is the balance that converts.",
  },
  ru: {
    kicker: "роадмап",
    title: "внутренний баланс — двигатель. base — цель.",
    sub: "Никаких форм и email-стен: зашёл — играешь, баланс растёт, а когда выйдет токен — баланс станет реальными деньгами.",
    phases: [
      {
        tag: "сейчас · в проде",
        title: "мгновенные аккаунты + внутренний баланс",
        accent: "lime" as const,
        items: [
          "порог входа = 0: аккаунт и welcome-баланс появляются сами при первой игре — без кошелька и форм",
          "внутренняя валюта — топливо всего: предикты, награды, сезоны",
          "начисляем валюту за целевые клики по спецблокам ленты",
          "начисляем валюту за количество переходов по твоим UTM-ссылкам — шэринг это выплата",
          "NR PASS (бесплатно): привяжи кошелёк → дневной бонус, стрики, повышенные капсы",
          "пополнение только крипто — USDT через 2328.io",
        ],
      },
      {
        tag: "дальше",
        title: "сезоны, призы, авторы",
        accent: "bone" as const,
        items: [
          "сезоны Best Eyes leaderboard с призовыми пулами во внутренней валюте",
          "турниры Daily Hard Mode — маленький вход, большой банк",
          "бусты и фичеред-слоты авторов из баланса",
          "реферальные выплаты переходят с ручного USDT на мгновенное начисление в баланс",
        ],
      },
      {
        tag: "base",
        title: "токен $NR на Base",
        accent: "blood" as const,
        items: [
          "$NR выходит на Base (L2 от Coinbase) — быстро, дёшево, ончейн",
          "внутренняя валюта конвертируется в $NR 1:1 на TGE — наигранное становится твоим мешком",
          "$NR ↔ USDC: внутренняя валюта превращается в выводимые реальные деньги",
          "ончейн-лидерборд и ончейн-награды за UTM для авторов",
          "адрес контракта опубликуем здесь первым — остерегайтесь подделок",
        ],
      },
    ],
    note: "даты двигаются — направление нет. баланс, наигранный сегодня, и есть тот, что конвертируется.",
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
