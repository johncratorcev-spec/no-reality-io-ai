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
 * Общий шелл юридических страниц: белый фон, Manrope, минимализм бренда.
 * Верх — логотип-ссылка на ленту, контент — узкая колонка для чтения.
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
    <div className="min-h-screen bg-white">
      {/* верхняя панель */}
      <header className="sticky top-0 z-40 border-b border-[#10161d]/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <a
            href="/"
            className="text-[0.95rem] font-extrabold tracking-tight text-[#0a0a0a]"
          >
            no reality<span className="text-[#10161d]/40">.</span>
          </a>
          <a
            href="/"
            className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#10161d]/45 transition-colors hover:text-[#0a0a0a]"
          >
            ← back to feed
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-14">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[#10161d]/40">
          {kicker}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0a0a0a] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 inline-flex items-center rounded-full border border-[#10161d]/10 bg-[#10161d]/[0.03] px-3 py-1 text-[0.7rem] font-semibold text-[#10161d]/55">
          last updated: {updated}
        </p>

        <p className="mt-8 text-[0.95rem] font-medium leading-relaxed text-[#10161d]/85">
          {intro}
        </p>

        <div className="mt-10 space-y-10">
          {sections.map((section, i) => (
            <section key={section.heading}>
              <h2 className="flex items-baseline gap-2.5 text-[1.02rem] font-extrabold tracking-tight text-[#0a0a0a]">
                <span className="font-mono text-[0.72rem] font-bold text-[#10161d]/35">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 border-l-2 border-[#10161d]/[0.07] pl-4">
                {section.body.map((paragraph, j) => (
                  <p
                    key={j}
                    className="text-[0.88rem] leading-relaxed text-[#10161d]/75"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* контакт */}
        <section className="mt-14 rounded-3xl border border-[#10161d]/10 bg-[#10161d]/[0.025] px-6 py-7">
          <h2 className="text-[0.95rem] font-extrabold tracking-tight text-[#0a0a0a]">
            {contactName}
          </h2>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-[#10161d]/70">
            Questions, takedown requests, licensing and removal notices:{" "}
            <a
              href="https://t.me/your_betfriend"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#0a0a0a] underline decoration-[#10161d]/20 underline-offset-4 transition-colors hover:decoration-[#0a0a0a]"
            >
              {contactHandle}
            </a>
            .
          </p>
        </section>

        <p className="mt-10 text-center text-[0.7rem] font-semibold tracking-tight text-[#10161d]/35">
          your only limit is mind
        </p>
      </main>
    </div>
  );
}
