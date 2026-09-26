import type { ReactNode } from "react";

interface LegalSection {
  heading: string;
  body: string[];
}

interface LegalShellProps {
  kicker: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  contactName: string;
  contactHandle: string;
}

/**
 * Общий шелл юридических страниц: кровавый карнавал (nrld-page — ночь,
 * белый текст, кровь), Manrope, узкая колонка для чтения.
 */
export default function LegalShell({
  kicker,
  title,
  updated,
  intro,
  sections,
  contactName,
  contactHandle,
}: LegalShellProps) {
  return (
    <div className="nrld-page min-h-screen text-white">
      {/* верхняя панель */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08070b]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <a
            href="/"
            className="nrld-logo text-[0.95rem] font-extrabold tracking-tight"
          >
            no reality<span className="text-white/40">.</span>
          </a>
          <a
            href="/"
            className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-white/45 transition-colors hover:text-[#ff4d6e]"
          >
            ← back to feed
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-14">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[#ff4d6e]">
          {kicker}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] font-semibold text-white/55">
          last updated: {updated}
        </p>

        <p className="mt-8 text-[0.95rem] font-medium leading-relaxed text-white/85">
          {intro}
        </p>

        <div className="mt-10 space-y-10">
          {sections.map((section, i) => (
            <section key={section.heading}>
              <h2 className="flex items-baseline gap-2.5 text-[1.02rem] font-extrabold tracking-tight text-white">
                <span className="font-mono text-[0.72rem] font-bold text-[#ff4d6e]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 border-l-2 border-white/10 pl-4">
                {section.body.map((paragraph, j) => (
                  <p
                    key={j}
                    className="text-[0.88rem] leading-relaxed text-white/75"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* контакт */}
        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-7">
          <h2 className="text-[0.95rem] font-extrabold tracking-tight text-white">
            {contactName}
          </h2>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-white/70">
            Questions, takedown requests, licensing and removal notices:{" "}
            <a
              href="https://t.me/your_betfriend"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-white underline decoration-[#ff003c]/40 underline-offset-4 transition-colors hover:decoration-[#ff003c]"
            >
              {contactHandle}
            </a>
            .
          </p>
        </section>

        <p className="mt-10 text-center text-[0.7rem] font-semibold tracking-tight text-white/35">
          your only limit is mind
        </p>
      </main>
    </div>
  );
}
