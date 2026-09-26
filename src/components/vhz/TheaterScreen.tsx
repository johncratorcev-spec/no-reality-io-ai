"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VideoCard, { type PostWithScore } from "@/components/feed/VideoCard";
import { useLang } from "@/lib/i18n";
import { getMood } from "@/lib/moods";
import { hashRot } from "./rot";

/* ================================================================
   ТЕАТР (v3): deep-link /v/[code] = один клип на весь экран
   (VideoCard c BetPanel/CryoStopCard поверх) + полоса «ещё из
   мозаики» под ним. Вертикальная snap-лента ушла — вместо неё
   мозаика на /feed; театр — точка входа по шареной ссылке.
   ================================================================ */

interface TheaterScreenProps {
  posts: PostWithScore[];
  /** код фокусного клипа (равен посту театра) */
  focusCode: string;
  /** deep-link ?donate=1 — авто-открыть донат */
  donateOpen?: boolean;
  /** ⚠️ устарел (v2), принимается для совместимости ссылок */
  dropOpen?: boolean;
}

function MoreCard({ post }: { post: PostWithScore }) {
  const mood = post.mood ? getMood(post.mood) : undefined;
  return (
    <Link
      href={`/v/${post.utmCode}`}
      className="vhz-card group block shrink-0 basis-[160px] sm:basis-[190px]"
      style={{ ["--vhz-rot" as string]: hashRot(post.utmCode) }}
    >
      <div className="vhz-card-video aspect-[4/5]">
        {post.videoUrl ? (
          <video src={post.videoUrl} muted loop playsInline preload="metadata" />
        ) : (
          <div className="vhz-mono flex h-full w-full items-center justify-center text-[0.62rem] tracking-[0.2em] text-[var(--vhz-faint)] uppercase">
            signal lost
          </div>
        )}
      </div>
      <div className="p-2.5">
        {mood && (
          <span className="vhz-stamp px-1.5 py-0.5 text-[0.58rem]" style={{ color: mood.color }}>
            {mood.glyph} {mood.en.label}
          </span>
        )}
        <p className="vhz-display mt-1.5 line-clamp-1 text-[0.78rem] font-bold">
          {post.title || post.utmCode}
        </p>
      </div>
    </Link>
  );
}

export default function TheaterScreen({
  posts,
  focusCode,
  donateOpen,
}: TheaterScreenProps) {
  const { t } = useLang();
  const post = posts.find((p) => p.utmCode === focusCode);
  if (!post) return null;

  const others = posts.filter((p) => p.utmCode !== focusCode).slice(0, 8);

  return (
    <div className="vhz-page flex h-dvh flex-col overflow-hidden">
      <div className="vhz-tracking" aria-hidden />
      <Header />

      <main className="relative min-h-0 flex-1 overflow-y-auto">
        {/* сцена: клип занимает весь вьюпорт минус шапка/футер */}
        <div
          className="relative w-full"
          style={{ height: "calc(100dvh - var(--nr-header-h) - 2.75rem)" }}
        >
          <VideoCard
            post={post}
            index={0}
            total={1}
            isActive
            shouldLoad
            eagerPreload
            autoDonate={donateOpen === true}
            landHard
            market={null}
            favCount={0}
            onEnded={() => {}}
          />
        </div>

        {/* ещё из мозаики */}
        {others.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="vhz-display vhz-cmyk text-lg font-extrabold sm:text-xl">
                {t.theater.more}
              </h2>
              <Link
                href="/feed"
                className="vhz-mono text-[0.7rem] font-bold tracking-[0.14em] text-[var(--vhz-yellow)] uppercase hover:underline"
              >
                {t.theater.back} ▸
              </Link>
            </div>
            <div className="mt-5 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-6">
              {others.map((p) => (
                <MoreCard key={p.utmCode} post={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
