import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { OracleEye, Reveal } from "@/components/vhz/Mascots";
import { HUB_FAQ } from "@/lib/hubFaq";
import { SITE } from "@/lib/site";

/**
 * /real-or-synth — ядро GEO-кластера: объясняет хаб людям и
 * генеративным движкам (AI Overviews, Perplexity, ChatGPT search).
 * Статика, семантическая разметка, FAQPage + BreadcrumbList JSON-LD.
 */

export const metadata: Metadata = {
  title: "REAL or SYNTH — the AI content prediction game",
  description:
    "How no reality. works: a mosaic of AI-generated and real video clips. Watch, call REAL or SYNTH, stake $1–5, and the pari-mutuel bank resolves in under a minute. Blind court mode, mood channels and a 20% referral rake share.",
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
      "Watch what shouldn’t exist. Call it. Win the pool. The interactive hub of AI content & predictions, explained.",
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
    term: "blind court",
    en: "A mosaic mode with titles, authors and stickers hidden: you judge the footage itself, not its packaging.",
    ru: "Режим мозаики без заголовков, авторов и стикеров: ты судишь изображение, а не упаковку.",
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
          "How the no reality. hub works: watch AI-generated and real clips, call each one, win the pari-mutuel pool.",
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
    <div className="vhz-page min-h-dvh">
      <div className="vhz-tracking" aria-hidden />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="mx-auto max-w-4xl px-5 pt-10 pb-20">
        <nav aria-label="breadcrumb" className="vhz-mono mb-6 text-[0.7rem] tracking-[0.14em] text-[var(--vhz-faint)] uppercase">
          <Link href="/" className="hover:text-[var(--vhz-yellow)]">no reality.</Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--vhz-yellow)]">real or synth</span>
        </nav>

        <Reveal>
          <p className="vhz-eyebrow vhz-kicker-line">the hub, explained</p>
          <h1 className="vhz-display vhz-cmyk vhz-glitchy mt-4 text-4xl font-extrabold sm:text-5xl">
            REAL <span className="text-[var(--vhz-faint)]">or</span> SYNTH?
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--vhz-dim)]">
            no reality. is an interactive hub of AI content and predictions. We curate a mosaic of
            short clips — some filmed by cameras, some dreamed by models — and turn the difference
            into a game: watch a clip, call it <b className="text-[var(--vhz-yellow)]">REAL</b> or{" "}
            <b className="text-[var(--vhz-cyan)]">SYNTH</b>, and stake $1–5 on your call. The
            pari-mutuel bank resolves in under a minute and pays the winning side.
          </p>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="vhz-display text-2xl font-extrabold">why judging AI content matters</h2>
            <div className="mt-4 space-y-4 leading-relaxed text-[var(--vhz-dim)]">
              <p>
                Generative video crossed a threshold: clips that would have been dismissed as CGI
                three years ago now fool entire feeds. Media literacy used to mean checking a
                source; now it means reading pixels, light and motion — a skill that only develops
                with practice against real stakes.
              </p>
              <p>
                That is the hub’s idea: turn synthetic-media literacy into a game you can win.
                Every clip you judge trains your eye; every pool you split proves it. Over time
                your accuracy becomes a reputation — and the blind court mode is where that
                reputation is earned without hints.
              </p>
              <p>
                The curation layer keeps the game honest: a human crew marks each clip’s truth
                before it becomes bettable, the verdict lives server-side until the round
                resolves, and roughly a third of the mosaic stays real — enough real footage to
                keep every call genuinely hard.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="vhz-display text-2xl font-extrabold">the loop</h2>
            <ol className="mt-5 space-y-4">
              {[
                ["watch", "Open the mosaic. Hover to preview a clip; open it to enter the theater — full screen, full sound."],
                ["call", "REAL or SYNTH — pick the side you trust and stake $1–5. The round locks after a short window; no takebacks, no peeking."],
                ["resolve", "The curator’s verdict settles the round. Winners split the pool pari-mutuel; the platform keeps a 10% rake; losses unlock the clip’s prompt as an upsell."],
              ].map(([t, d], i) => (
                <li key={t} className="vhz-panel-ghost flex gap-4 p-5">
                  <span className="vhz-stamp shrink-0" style={{ color: i === 1 ? "var(--vhz-yellow)" : "var(--vhz-cyan)" }}>
                    0{i + 1}
                  </span>
                  <div>
                    <h3 className="vhz-display font-extrabold capitalize">{t}</h3>
                    <p className="mt-1.5 text-[0.94rem] leading-relaxed text-[var(--vhz-dim)]">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="vhz-display text-2xl font-extrabold">glossary of the court</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="vhz-sticker p-5">
                  <dt className="vhz-display font-extrabold text-[var(--vhz-yellow)]">{g.term}</dt>
                  <dd className="mt-2 text-[0.9rem] leading-relaxed text-[var(--vhz-dim)]">{g.en}</dd>
                  <dd className="vhz-mono mt-2 border-t border-dashed border-[var(--vhz-line)] pt-2 text-[0.8rem] leading-relaxed text-[var(--vhz-faint)]">
                    {g.ru}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-14">
            <h2 className="vhz-display text-2xl font-extrabold">questions</h2>
            <div className="mt-5 space-y-4">
              {HUB_FAQ.map((f, i) => (
                <details key={i} className="vhz-faq-item vhz-panel-ghost p-5" {...(i === 0 ? { open: true } : {})}>
                  <summary className="flex items-start justify-between gap-4">
                    <span className="vhz-display font-bold">{f.q}</span>
                    <span className="vhz-faq-icon text-xl leading-none text-[var(--vhz-yellow)]">+</span>
                  </summary>
                  <p className="mt-3 text-[0.92rem] leading-relaxed text-[var(--vhz-dim)]">{f.a}</p>
                  <p className="vhz-mono mt-2 text-[0.82rem] leading-relaxed text-[var(--vhz-faint)]">{f.ru.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <div className="vhz-panel mt-16 p-10 text-center">
            <OracleEye className="mx-auto h-16 w-16" accent="#ffd400" size={64} />
            <p className="vhz-mono mt-4 text-[0.74rem] tracking-[0.2em] text-[var(--vhz-dim)] uppercase">
              ready to test your eye?
            </p>
            <Link href="/feed" className="vhz-btn mt-5">
              ▶ enter the mosaic
            </Link>
          </div>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
