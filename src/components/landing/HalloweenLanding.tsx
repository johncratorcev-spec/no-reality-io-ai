"use client";

import { useLang } from "@/lib/i18n";
import { HwFilters, HwSkull, HwBat, HwSeam } from "./hwArt";
import "./halloween-landing.css";

/**
 * v21 — ЛЕНДИНГ «СУДНАЯ НОЧЬ», ОДИН ЭКРАН (минимализм вместо 6-сценового
 * онбординга v19): череп-судья с редким подмигиванием, чипы REAL/SYNTH,
 * 3 микро-шага и сразу CTA → /auth (+100 EYE). Виральность — в крючке
 * «+100 EYE gift» и таймере сезона. Всё движение — CSS (transform/opacity),
 * prefers-reduced-motion гасит анимации. Скримеры упрощены до мигания
 * глаз и пролетающих мышей — без JS-таймеров.
 */

interface Props {
  snapshotLabel: string;
  hasSeason: boolean;
  dayOf: number;
}

export default function HalloweenLanding(_props: Props) {
  const { t, lang, setLang } = useLang();

  return (
    <section className="hwl" aria-label="no-reality — real or synth">
      <HwFilters />

      {/* переключатель языка — единственный элемент шапки, вынесен в угол */}
      <button
        type="button"
        className="hwl-lang"
        onClick={() => setLang(lang === "ru" ? "en" : "ru")}
        aria-label="switch language"
      >
        {lang === "ru" ? "en" : "ru"}
      </button>

      {/* мыши-тени, пролетающие через экран */}
      <div aria-hidden className="hwl-bats">
        <HwBat className="hwl-bat hwl-bat-1" />
        <HwBat className="hwl-bat hwl-bat-2" />
        <HwBat className="hwl-bat hwl-bat-3" />
      </div>

      <div className="hwl-center">
        <p className="hwl-pill">
          <span className="hwl-pill-dot" aria-hidden />
          {t.hwl.pill}
        </p>

        <HwSkull className="hwl-skull" eyeColor="#ff7a1a" />

        <h1 className="hwl-title">
          <span className="hwl-chip hwl-chip-real">{t.hwl.heroT1}</span>
          <span className="hwl-or">{t.hwl.heroT2}</span>
          <span className="hwl-chip hwl-chip-synth">{t.hwl.heroT3}</span>
        </h1>

        <HwSeam className="hwl-seam" />

        <p className="hwl-sub">{t.hwl.heroSub}</p>

        <ol className="hwl-steps" aria-label="how it works">
          <li className="hwl-step">
            <span className="hwl-step-n" aria-hidden>1</span>
            {t.hwl.m1}
          </li>
          <li className="hwl-step">
            <span className="hwl-step-n" aria-hidden>2</span>
            {t.hwl.m2}
          </li>
          <li className="hwl-step">
            <span className="hwl-step-n" aria-hidden>3</span>
            {t.hwl.m3}
          </li>
        </ol>

        <a href="/auth" className="hwl-cta">
          {t.hwl.cta}
          <span aria-hidden className="hwl-cta-arrow">→</span>
        </a>
        <a href="/bet" className="hwl-ghost">
          {t.hwl.ghost}
        </a>

        <p className="hwl-fine">{t.hwl.fine}</p>
      </div>
    </section>
  );
}
