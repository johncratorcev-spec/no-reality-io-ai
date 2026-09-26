import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Reveal from "@/components/landing/Reveal";
import { JokerFace } from "@/components/landing/Characters";
import { HUB_FAQ } from "@/lib/hubFaq";
import { SITE } from "@/lib/site";

/**
 * /real-or-synth — ядро GEO-кластера: объясняет игру людям и
 * генеративным движкам (AI Overviews, Perplexity, ChatGPT search).
 * Статика, семантическая разметка, FAQPage + BreadcrumbList JSON-LD.
 */

export const metadata: Metadata = {
  title: "REAL or SYNTH — the AI content prediction game",
  description:
    "How no reality. works: two feeds — an endless stream of curated AI video, and blind raffles where you call REAL or SYNTH, stake $1–5 and split the pari-mutuel bank in under a minute. Plus a 20% referral rake share.",
  alternates: {
    canonical: "/real-or-synth",
    languages: {
      en: "/real-or-synth",
      ru: "/real-or-synth?lang=ru",
      "x-default": "/real-or-synth",
    },
  },
  openGraph: {
    title: "REAL or SYNTH — the AI content prediction game",
    description:
      "Watch what shouldn’t exist. Call it. Win the pool. The game behind no reality., explained.",
    url: "/real-or-synth",
    type: "article",
    images: ["/images/og-vhs.png"],
  },
};

const GLOSSARY = [
  {
    term: "REAL",
    en: "Footage captured by a camera that was physically there. Curator-verified before a clip becomes bettable.",
    ru: "Кадр, снятый камерой, которая физически там была. Проверяется куратором до того, как клип станет ставочным.",
  },
  {
    term: "SYNTH",
    en: "A machine dream: fully or partially AI-generated video. The models behind it improve weekly — so does the court.",
    ru: "Машинный сон: полностью или частично сгенерированное AI видео. Модели улучшаются каждую неделю — вместе с ними и суд.",
  },
  {
    term: "the seam",
    en: "The invisible boundary between real and synthetic. Betting on the seam means taking a position on which side of it a clip lives.",
    ru: "Невидимая граница между реальностью и синтетикой. Ставка на шов — позиция о том, по какую сторону живёт клип.",
  },
  {
    term: "the raffles",
    en: "Blind prediction rounds: titles and authors are hidden, so you judge the footage itself — not its packaging.",
    ru: "Слепые раунды-рафлы: заголовки и авторы скрыты — ты судишь само изображение, а не упаковку.",
  },
  {
    term: "pari-mutuel pool",
    en: "All stakes on a clip go into one bank. Winners split it proportionally — you are not betting against the house, you are betting with and against other eyes.",
    ru: "Все ставки клипа складываются в один банк. Победители делят его пропорционально — ты играешь не против дома, а вместе и против других глаз.",
  },
  {
    term: "rake",
    en: "The platform's 10% cut of the pool. Part of it funds the curator, part flows to referrers who brought the eyes.",
    ru: "10% платформы с пула. Часть идёт куратору, часть — тем, кто привёл глаза по рефссылкам.",
  },
];

export default function RealOrSynthPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "REAL or SYNTH — the AI content prediction game",
        description:
          "How no reality. works: watch AI-generated and real clips, call each one, win the pari-mutuel pool.",
        inLanguage: "en",
        author: { "@type": "Organization", name: SITE.name, url: SITE.url },
        publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
        mainEntityOfPage: `${SITE.url}/real-or-synth`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "no reality.", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "REAL or SYNTH", item: `${SITE.url}/real-or-synth` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: HUB_FAQ.slice(0, 5).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="nrld-page min-h-dvh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="mx-auto max-w-4xl px-5 pt-10 pb-20">
        <nav
          aria-label="breadcrumb"
          className="mb-6 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/40"
        >
          <Link href="/" className="transition-colors hover:text-white">
            no reality.
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#FF003C]">real or synth</span>
        </nav>

        <Reveal>
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">
            the game, explained
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            REAL <span className="text-white/35">or</span>{" "}
            <span className="nrld-blood-text">SYNTH?</span>
          </h1>
          <p className="mt-6 text-lg font-semibold leading-relaxed text-white/75">
            no reality. runs two feeds. The first is an endless stream of curated AI
            video — pure watching. The second is the court: every clip is either filmed
            by a camera or dreamed by a model, and you call it{" "}
            <b className="text-white">REAL</b> or <b className="text-[#FF003C]">SYNTH</b>,
            staking $1–5 on your eye. The pari-mutuel bank resolves in under a minute
            and pays the winning side.
          </p>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              why judging AI content matters
            </h2>
            <div className="mt-4 space-y-4 text-[0.98rem] font-semibold leading-relaxed text-white/70">
              <p>
                Generative video crossed a threshold: clips that would have been dismissed as CGI
                three years ago now fool entire feeds. Media literacy used to mean checking a
                source; now it means reading pixels, light and motion — a skill that only develops
                with practice against real stakes.
              </p>
              <p>
                That is the idea behind the raffles: turn synthetic-media literacy into a game you
                can win. Every clip you judge trains your eye; every pool you split proves it. Over
                time your accuracy becomes a reputation — and the blind format is where that
                reputation is earned without hints.
              </p>
              <p>
                The curation layer keeps the game honest: a human crew marks each clip’s truth
                before it becomes bettable, the verdict lives server-side until the round
                resolves, and roughly a third of the deck stays real — enough real footage to
                keep every call genuinely hard.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">the loop</h2>
            <ol className="mt-5 space-y-4">
              {[
                ["watch", "Scroll the feed — an endless stream of machine dreams and real footage, one clip at a time. No account, no paywall."],
                ["call", "Switch to the raffles: the clip loses its title and author. REAL or SYNTH — pick the side you trust and stake $1–5. The round locks after a short window; no takebacks, no peeking."],
                ["resolve", "The curator’s verdict settles the round. Winners split the pool pari-mutuel; the platform keeps a 10% rake; referrers keep 20% of it."],
              ].map(([t, d], i) => (
                <li key={t} className="nrld-panel flex gap-4 rounded-3xl p-5">
                  <span
                    className="shrink-0 text-[1.1rem] font-black leading-none"
                    style={{ color: i === 1 ? "#FF003C" : "#D9A441" }}
                  >
                    0{i + 1}
                  </span>
                  <div>
                    <h3 className="font-extrabold capitalize text-white">{t}</h3>
                    <p className="mt-1.5 text-[0.94rem] font-semibold leading-relaxed text-white/65">
                      {d}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              glossary of the court
            </h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="nrld-panel rounded-3xl p-5">
                  <dt className="font-extrabold text-[#D9A441]">{g.term}</dt>
                  <dd className="mt-2 text-[0.9rem] font-semibold leading-relaxed text-white/70">
                    {g.en}
                  </dd>
                  <dd className="mt-2 border-t border-dashed border-white/12 pt-2 text-[0.8rem] font-semibold leading-relaxed text-white/45">
                    {g.ru}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">questions</h2>
            <div className="mt-5 space-y-4">
              {HUB_FAQ.map((f, i) => (
                <details
                  key={i}
                  className="nrld-panel group rounded-3xl p-5"
                  {...(i === 0 ? { open: true } : {})}
                >
                  <summary className="flex items-start justify-between gap-4">
                    <span className="font-bold text-white">{f.q}</span>
                    <span
                      aria-hidden
                      className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF003C] text-lg leading-none text-white transition-transform duration-300 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[0.92rem] font-semibold leading-relaxed text-white/70">
                    {f.a}
                  </p>
                  <p className="mt-2 border-t border-dashed border-white/12 pt-2 text-[0.82rem] font-semibold leading-relaxed text-white/45">
                    {f.ru.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <div className="nrld-panel-blood mt-16 rounded-[2.5rem] p-10 text-center">
            <JokerFace className="mx-auto h-16 w-16" />
            <p className="mt-4 text-[0.74rem] font-extrabold uppercase tracking-[0.2em] text-white/60">
              ready to test your eye?
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/bet"
                className="nrld-btn-blood inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.8rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
              >
                ▶ enter the raffles
              </Link>
              <Link
                href="/feed"
                className="nrld-btn-ghost inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.8rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.03] active:scale-95"
              >
                just watch the feed
              </Link>
            </div>
          </div>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
