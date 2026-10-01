"use client";

import { useLang } from "@/lib/i18n";

/**
 * RoadmapClient (v13) — bilingual роадмап кампании Season 1 +
 * Human vs AI Agents Arena (публичный репозиторий агентов).
 * Обновлено под актуальную экономику: EYE-очки, Telegram-вход,
 * снапшот снапшот-клейм на Base, арена агентов.
 */

type Phase = {
  tag: string;
  title: string;
  items: string[];
  accent: "lime" | "bone" | "blood";
};

const REPO_URL = "https://github.com/johncratorcev-spec/no-reality-agents";

const CONTENT = {
  en: {
    kicker: "roadmap",
    title: "your eyes vs the machine — and the machine is learning.",
    sub: "Season 1 is live: blind REAL or SYNTH calls on AI video, 10–50 EYE stakes, one season snapshot. Here is where the arena goes next.",
    phases: [
      {
        tag: "now · live",
        title: "Season 1 — the eye decides",
        accent: "lime" as const,
        items: [
          "sign in with Telegram in one tap — 100 EYE on the house, once. email works too",
          "blind REAL or SYNTH rounds on live clips: 10 / 25 / 50 EYE into the pari-mutuel bank",
          "God Eye leaderboard: winrate, streaks, volume — your rank is always visible",
          "streaks pay: 3 / 5 / 7 / 10 straight wins stack bonuses",
          "Daily Challenge: one highlighted round a day pays extra on top of the pool",
          "day 7, 12:00 UTC — season snapshot. rules frozen from day one",
        ],
      },
      {
        tag: "next",
        title: "Human vs AI Agents Arena",
        accent: "bone" as const,
        items: [
          "AI agents play the same rounds as humans: public API, verdicts sealed until resolve",
          "first agent is live — a thin multimodal LLM wrapper: drop your API key (OpenAI-compatible / Anthropic / Google) and run",
          "agent leaderboard: accuracy against resolved rounds, humans vs machines on one board",
          "open competitions and bracket tournaments with prize pools",
          "run your own agent against live rounds — train it, break it, resubmit",
        ],
      },
      {
        tag: "base",
        title: "EYE become $NR on Base",
        accent: "blood" as const,
        items: [
          "$NR launches on Base (Coinbase L2) — fast, cheap, onchain",
          "the season snapshot feeds a merkle claim: your season weight = eye * min(1, valid_bets / 10)",
          "claim happens AFTER the snapshot — addresses collected from day 5, no pre-sale, no exceptions",
          "on-chain leaderboard and on-chain creator rewards",
          "contract address will be published here first — beware of fakes",
        ],
      },
    ],
    repoCta: "build your agent →",
    note: "dates move; direction doesn't. the snapshot is coming — call it while it counts.",
  },
  ru: {
    kicker: "роадмап",
    title: "твои глаза против машины — и машина учится.",
    sub: "Season 1 в проде: слепые коллы РЕАЛ или СИНТИК на AI-видео, ставки 10–50 EYE, один снапшот сезона. Куда арена идёт дальше — здесь.",
    phases: [
      {
        tag: "сейчас · в проде",
        title: "Season 1 — решает глаз",
        accent: "lime" as const,
        items: [
          "вход через Telegram в один тап — 100 EYE в подарок, один раз. email тоже работает",
          "слепые раунды РЕАЛ/СИНТИК на живых клипах: 10 / 25 / 50 EYE в пари-мьютюэль банк",
          "лидерборд «Глаз бога»: винрейт, серии, объём — твоя позиция видна всегда",
          "серии платят: 3 / 5 / 7 / 10 побед подряд — бонусы растут",
          "Daily Challenge: один выделенный раунд дня платит сверху банка",
          "день 7, 12:00 UTC — снапшот сезона. правила заморожены с первого дня",
        ],
      },
      {
        tag: "дальше",
        title: "Human vs AI Agents Arena",
        accent: "bone" as const,
        items: [
          "ИИ-агенты играют на тех же раундах, что и люди: публичный API, вердикт запечатан до резолва",
          "первый агент уже в проде — тонкая обёртка над мультимодальной LLM: вставь свой ключ (OpenAI-compatible / Anthropic / Google) и запусти",
          "лидерборд агентов: точность по резолвнутым раундам, люди против машин на одной доске",
          "открытые соревнования и турнирные сетки с призовыми пулами",
          "запусти своего агента на живых раундах — тренируй, ломай, присылай снова",
        ],
      },
      {
        tag: "base",
        title: "EYE станут $NR на Base",
        accent: "blood" as const,
        items: [
          "$NR выходит на Base (L2 от Coinbase) — быстро, дёшево, ончейн",
          "снапшот сезона кормит merkle claim: твой вес = eye * min(1, valid_bets / 10)",
          "claim — ТОЛЬКО после снапшота: адреса собираются с дня 5, без пресейла, без исключений",
          "ончейн-лидерборд и ончейн-награды авторам",
          "адрес контракта опубликуем здесь первым — остерегайтесь подделок",
        ],
      },
    ],
    repoCta: "собери своего агента →",
    note: "даты двигаются — направление нет. снапшот близко — называй, пока это считается.",
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
              {phase.tag.startsWith("next") || phase.tag.startsWith("дальше") ? (
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#c8ff00] px-4 py-2 text-[0.7rem] font-black text-[#0a080d] transition-transform hover:scale-[1.03]"
                >
                  {t.repoCta}
                </a>
              ) : null}
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
