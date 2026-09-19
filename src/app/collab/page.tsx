import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  Heart,
  Home,
  Instagram,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getRankedPosts } from "@/lib/posts";
import { PARTNER_OF_WEEK, SITE } from "@/lib/site";
import Reveal from "@/components/collab/Reveal";
import ShareButton from "@/components/collab/ShareButton";
import CollabPlayer from "@/components/collab/CollabPlayer";
import CatEgg from "@/components/collab/CatEgg";
import PromptDropCard from "@/components/feed/PromptDropCard";
import Menu from "@/components/menu/Menu";

/**
 * /collab — страница коллаборации no reality. × paw crew daily.
 * Вирусные, но лёгкие анимации: canvas-confetti (~2KB gzip) +
 * чистые CSS/IntersectionObserver/rAF. Никаких тяжёлых рантаймов.
 */

export const metadata: Metadata = {
  title: "no reality. × paw crew daily — the cat collab",
  description:
    "One very bad trading night, two cat crews and a charity drive: 100% of every crypto donation goes to cat shelters. Watch the collab, share the love, make the world better.",
  openGraph: {
    title: "no reality. × paw crew daily — the cat collab",
    description:
      "A crypto trader cat has a bad night 📉 — and every cent of the charity drive goes to cat shelters.",
    url: `${SITE.url}/collab`,
    type: "website",
  },
};

/** канонический пост коллаборации в Threads (цитата @mmayrday у @pawcrewdaily) */
const THREADS_POST = "https://www.threads.com/@pawcrewdaily/post/DdX3O2eEo-z";
const COLLAB_CODE = "71vsIPUu";

const MARQUEE = [
  "no reality. × paw crew daily",
  "🐾 every paw counts",
  "🧡 100% goes to shelters",
  "📉 one very bad trading night",
  "🎬 AI dreams, cats curate",
  "🐾 crypto in — kibble out",
];

const STORY = [
  {
    n: "01",
    icon: Sparkles,
    title: "the clip that escaped the lab",
    text: "we build the machines that dream; paw crew daily curates the most expressive cats on the planet. one shared obsession — the perfect frame — turned into a crossover episode: our AI trader cat, their crew, one very bad night on the charts.",
  },
  {
    n: "02",
    icon: Coins,
    title: "then we made it mean something",
    text: "a crossover is cute, but cats in shelters are real. so the collab became a charity drive: every crypto donation on the pinned posts settles on-chain via 2328.io and goes to cat shelters — food, warm beds, litter, vet care.",
  },
  {
    n: "03",
    icon: Home,
    title: "where it goes next",
    text: "the drive keeps rolling while the collab lives on the feed. watch the clip, send a treat, share the story — every tap has a tail. the shelters feel every single paw print you leave here.",
  },
];

export default async function CollabPage() {
  const posts = await getRankedPosts();
  const post = posts.find((p) => p.utmCode === COLLAB_CODE);
  const drive = PARTNER_OF_WEEK.charityDrive;
  const shareUrl = `${SITE.url}/collab`;
  const videoSrc = post?.videoUrl || "";

  return (
    <div className="min-h-dvh bg-white text-[#10161d]">
      {/* ================= ПЛАВАЮЩАЯ НАВИГАЦИЯ ================= */}
      <div className="fixed inset-x-0 top-3 z-[70] px-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <a
            href="/"
            className="nr-glass-deep inline-flex items-center rounded-full px-4 py-2 text-[0.95rem] font-extrabold leading-none tracking-tight"
          >
            <span className="nr-logo">no reality.</span>
          </a>
          <div className="ml-auto">
            <Menu />
          </div>
        </div>
      </div>

      {/* ================= HERO ================= */}
      <section className="nr-collab-hero relative overflow-hidden">
        {/* плавающие лапки — декор */}
        <span aria-hidden className="nr-collab-float pointer-events-none absolute left-[6%] top-[16%] text-4xl opacity-25" style={{ ["--fd" as string]: "7s" }}>🐾</span>
        <span aria-hidden className="nr-collab-float pointer-events-none absolute right-[9%] top-[10%] text-5xl opacity-20" style={{ ["--fd" as string]: "9s" }}>🧡</span>
        <span aria-hidden className="nr-collab-float pointer-events-none absolute left-[16%] bottom-[12%] text-3xl opacity-20" style={{ ["--fd" as string]: "8s" }}>🧡</span>
        <span aria-hidden className="nr-collab-float pointer-events-none absolute right-[18%] bottom-[20%] text-4xl opacity-25" style={{ ["--fd" as string]: "6.5s" }}>🐾</span>

        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-14 pt-20 text-center sm:pt-24">
          <Reveal>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.28em] text-[#e4713b]">
              special collaboration
            </p>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="nr-collab-shimmer mt-4 text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-[4rem]">
              no reality. ×<br />
              paw crew daily
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mx-auto mt-5 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-[#10161d]/65 sm:text-base">
              a crypto trader cat has a very bad night 📉 — and it turns into
              something good: a charity drive where{" "}
              <b className="text-[#10161d]">100% of every crypto donation</b>{" "}
              goes to cat shelters. watch the clip, send a treat, pass it on.
            </p>
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/v/${COLLAB_CODE}?donate=1`}
                className="nr-cta-warm inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.82rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
              >
                <Heart className="h-4 w-4 fill-current" aria-hidden />
                make world better
              </Link>
              <ShareButton
                url={shareUrl}
                title="no reality. × paw crew daily"
                text="a crypto trader cat has a bad night 📉 — and every cent goes to cat shelters 🐾"
              />
            </div>
          </Reveal>

          <Reveal delay={340}>
            <div className="mt-12">
              <CatEgg />
            </div>
          </Reveal>
        </div>

        {/* ================= MARQUEE ================= */}
        <div aria-hidden className="nr-marquee border-y border-[#10161d]/8 bg-[#fff7ef] py-3">
          {[0, 1].map((t) => (
            <div className="nr-marquee-track" key={t}>
              {MARQUEE.map((m, i) => (
                <span
                  key={i}
                  className="flex items-center gap-8 whitespace-nowrap pr-8 text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-[#10161d]/45"
                >
                  {m}
                  <span className="text-[#e4713b]/70">🐾</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ================= ВИДЕО ================= */}
      <section className="mx-auto max-w-4xl px-5 py-20 sm:py-24">
        <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:justify-center sm:gap-14">
          <Reveal>
            {videoSrc ? (
              <CollabPlayer
                src={videoSrc}
                threadsUrl={THREADS_POST}
                caption="the collab clip — «crypto trader cat has a bad night 📉» with @mmayrday"
              />
            ) : (
              <a
                href={THREADS_POST}
                target="_blank"
                rel="noopener noreferrer"
                className="flex aspect-[9/16] max-h-[70vh] w-full max-w-xs flex-col items-center justify-center gap-3 rounded-[2rem] border border-[#a8cfea]/50 bg-gradient-to-b from-[#f2f8fd] to-[#dcebf7] text-center text-[#10161d]/80 transition-transform duration-300 hover:scale-[1.02] sm:max-w-sm"
              >
                <span className="text-5xl">🎬</span>
                <span className="px-6 text-[0.8rem] font-extrabold leading-relaxed">
                  watch the collab on Threads
                </span>
              </a>
            )}
          </Reveal>

          <div className="max-w-sm">
            <Reveal delay={120}>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.28em] text-[#e4713b]">
                the original
              </p>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                63 seconds of pure trading pain
              </h2>
              <p className="mt-4 text-[0.88rem] font-semibold leading-relaxed text-[#10161d]/65">
                @pawcrewdaily&apos;s trader cat watches the charts go the way
                charts should not go, live, in one take. the internet did what
                the internet does — and the clip became the face of our
                charity drive.
              </p>
              <a
                href={THREADS_POST}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-[0.74rem] font-extrabold text-[#e4713b] transition-colors hover:text-[#c25a2b]"
              >
                see the original post
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= PROMPT DROP ================= */}
      <PromptDropCard variant="section" />

      {/* ================= ИСТОРИЯ ================= */}
      <section className="bg-[#fff7ef]/60 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-5">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
              how a bad night became a good deed
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {STORY.map((s, i) => (
              <Reveal key={s.n} delay={i * 120} className="h-full">
                <article className="nr-story-card flex h-full flex-col rounded-3xl bg-white p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.7rem] font-extrabold tracking-[0.2em] text-[#10161d]/30">
                      {s.n}
                    </span>
                    <s.icon className="h-5 w-5 text-[#e4713b]" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-[1.02rem] font-extrabold leading-snug tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-[0.78rem] font-semibold leading-relaxed text-[#10161d]/60">
                    {s.text}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= БЛАГОТВОРИТЕЛЬНОСТЬ ================= */}
      <section className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
        <Reveal>
          <div className="nr-charity-hero relative overflow-hidden rounded-[2.5rem] border border-[#f2d9c0] bg-gradient-to-br from-[#fff7ef] via-[#fff3e8] to-[#ffe9d9] px-7 py-14 text-center text-[#3d2314] sm:px-12">
            <span aria-hidden className="nr-collab-float pointer-events-none absolute left-[8%] top-[14%] text-4xl opacity-20" style={{ ["--fd" as string]: "7s" }}>🐾</span>
            <span aria-hidden className="nr-collab-float pointer-events-none absolute right-[10%] bottom-[16%] text-5xl opacity-15" style={{ ["--fd" as string]: "9s" }}>🐾</span>

            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.3em] text-[#c26d3f]/85">
              {drive.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {drive.title}
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[0.88rem] font-semibold leading-relaxed text-[#6b4a33]/80">
              {drive.body}
            </p>

            <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#3d2314]/8 px-4 py-2 text-[0.68rem] font-extrabold text-[#c26d3f]">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {drive.badge}
            </div>

            <div className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-2.5">
              {drive.steps.map((st) => (
                <span
                  key={st.text}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[0.6rem] font-extrabold text-[#6b4a33] ring-1 ring-[#3d2314]/10"
                >
                  {st.icon === "heart" && <Heart className="h-3 w-3 fill-current text-[#e4713b]" aria-hidden />}
                  {st.icon === "coins" && <Coins className="h-3 w-3 text-[#e4713b]" aria-hidden />}
                  {st.icon === "home" && <Home className="h-3 w-3 text-[#e4713b]" aria-hidden />}
                  {st.text}
                </span>
              ))}
            </div>

            <div className="mt-10">
              <Link
                href={`/v/${COLLAB_CODE}?donate=1`}
                className="nr-cta-glow inline-flex items-center gap-2 rounded-full bg-[#e4713b] px-8 py-3.5 text-[0.85rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.05] active:scale-95"
              >
                <Heart className="h-4 w-4 fill-current" aria-hidden />
                {drive.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <p className="mt-4 text-[0.58rem] font-bold text-[#6b4a33]/60">
                settled on-chain via 2328.io · you pick the coin &amp; network
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================= КРЕВ ================= */}
      <section className="mx-auto max-w-4xl px-5 pb-20 sm:pb-24">
        <Reveal>
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            the crew behind the fluff
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Reveal delay={0} className="h-full">
            <a
              href={PARTNER_OF_WEEK.url}
              target="_blank"
              rel="noopener noreferrer"
              className="nr-crew-card flex h-full flex-col rounded-3xl bg-[#fff7ef] p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <Instagram className="h-5 w-5 text-[#e4713b]" aria-hidden />
              <h3 className="mt-3 text-[0.95rem] font-extrabold tracking-tight">
                {PARTNER_OF_WEEK.name}
              </h3>
              <p className="text-[0.68rem] font-bold text-[#10161d]/45">
                {PARTNER_OF_WEEK.handle} · instagram
              </p>
              <p className="mt-2.5 text-[0.74rem] font-semibold leading-relaxed text-[#10161d]/60">
                cats, every single day — the fluffiest curation crew on the
                internet.
              </p>
            </a>
          </Reveal>
          <Reveal delay={110} className="h-full">
            <a
              href="https://www.threads.com/@mmayrday"
              target="_blank"
              rel="noopener noreferrer"
              className="nr-crew-card flex h-full flex-col rounded-3xl bg-[#fff7ef] p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <ArrowUpRight className="h-5 w-5 text-[#e4713b]" aria-hidden />
              <h3 className="mt-3 text-[0.95rem] font-extrabold tracking-tight">mmayrday</h3>
              <p className="text-[0.68rem] font-bold text-[#10161d]/45">@mmayrday · threads</p>
              <p className="mt-2.5 text-[0.74rem] font-semibold leading-relaxed text-[#10161d]/60">
                the voice of the trading desk — guest star of the collab clip.
              </p>
            </a>
          </Reveal>
          <Reveal delay={220} className="h-full">
            <a
              href="https://2328.io"
              target="_blank"
              rel="noopener noreferrer"
              className="nr-crew-card flex h-full flex-col rounded-3xl bg-[#fff7ef] p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <Coins className="h-5 w-5 text-[#e4713b]" aria-hidden />
              <h3 className="mt-3 text-[0.95rem] font-extrabold tracking-tight">2328.io</h3>
              <p className="text-[0.68rem] font-bold text-[#10161d]/45">crypto payments</p>
              <p className="mt-2.5 text-[0.74rem] font-semibold leading-relaxed text-[#10161d]/60">
                settles every donation on-chain — pick any coin, any network.
              </p>
            </a>
          </Reveal>
        </div>
      </section>

      {/* ================= ФИНАЛ ================= */}
      <section className="border-t border-[#10161d]/8 py-16">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 text-center">
          <Reveal>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.28em] text-[#e4713b]">
              one more tap
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              shared stories save tails
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[0.84rem] font-semibold leading-relaxed text-[#10161d]/60">
              every repost is a bowl of kibble that almost didn&apos;t happen.
              send this to someone who loves cats more than bull markets.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <ShareButton
                url={shareUrl}
                title="no reality. × paw crew daily"
                text="a crypto trader cat has a bad night 📉 — and every cent goes to cat shelters 🐾"
                label="share the collab"
              />
              <Link
                href="/feed"
                className="inline-flex items-center gap-2 rounded-full bg-[#10161d]/6 px-6 py-3 text-[0.82rem] font-extrabold text-[#10161d] transition-colors duration-300 hover:bg-[#10161d]/12"
              >
                back to the feed
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <p className="mt-10 text-[0.62rem] font-bold tracking-tight text-[#10161d]/35">
              no reality. — your only limit is mind · 🐾 every paw counts
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
