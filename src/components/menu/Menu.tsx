"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import WalletButton from "@/components/wallet/WalletButton";

/* ================================================================
   Меню сайта — стилизованная кнопка-бургер в стекле.

   Два варианта оформления:
    - light (по умолчанию): светлое перламутровое стекло —
      для светлых страниц (market, future, collab…);
    - dark: кровавое ночное стекло — для лендинга.
   Внутри — все «новые» разделы проекта (prompt market, collab,
   in future) + feed и сессия MetaMask. Кнопка морфит «бургер → ✕».

   Один компонент используется на всех страницах (feed, market,
   landing, collab, future), чтобы навигация была везде одинаковой.
   ================================================================ */

const ITEMS = [
  { href: "/feed", icon: "▸", label: "mosaic", desc: "watch & call real or synth" },
  { href: "/real-or-synth", icon: "◈", label: "what is the hub", desc: "AI content & predictions explained" },
  { href: "/predict", icon: "❄", label: "predictions", desc: "call the ending — any USDC stake" },
  { href: "/pnl", icon: "◑", label: "my positions", desc: "bets, payouts, cashout" },
  { href: "/market", icon: "◆", label: "prompt market", desc: "prompts behind the clips" },
  { href: "/future", icon: "✦", label: "in future", desc: "roadmap — ending predictions" },
] as const;

export default function Menu({ variant = "light" }: { variant?: "light" | "dark" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /* v3: весь сайт тёмный (VHS-zine) — тёмный вариант всегда.
     Проп light оставлен для совместимости вызовов. */
  const dark = true;

  /* клик вне панели и Esc закрывают */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* переход по разделу закрывает панель */
  const close = useCallback(() => setOpen(false), []);

  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/feed" && pathname.startsWith("/v/"));

  return (
    <div ref={rootRef} className="relative">
      {/* --- кнопка-бургер: стекло, линии морфят в ✕ --- */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className={`group inline-flex h-10 items-center gap-2 rounded-full px-3.5 transition-transform duration-300 hover:scale-[1.05] active:scale-95 ${
          dark ? "nrld-btn-blood text-white" : "nr-glass-deep"
        }`}
      >
        <span aria-hidden className="relative flex h-[14px] w-[18px] flex-col justify-between">
          <span
            className={`nr-burger-line ${dark ? "nr-burger-line-dark" : ""} ${open ? "translate-y-[6px] rotate-45" : ""}`}
          />
          <span
            className={`nr-burger-line ${dark ? "nr-burger-line-dark" : ""} ${open ? "scale-x-0 opacity-0" : ""}`}
          />
          <span
            className={`nr-burger-line ${dark ? "nr-burger-line-dark" : ""} ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
          />
        </span>
        <span
          className={`hidden text-[0.68rem] font-extrabold tracking-tight transition-colors sm:block ${
            dark ? "text-white/80 group-hover:text-white" : "text-[#10161d]/70 group-hover:text-[#0a0a0a]"
          }`}
        >
          {open ? "close" : "menu"}
        </span>
      </button>

      {/* --- панель: разделы + кошелёк --- */}
      {open && (
        <div
          role="menu"
          aria-label="Site menu"
          className={`nr-menu-pop absolute right-0 top-[calc(100%+10px)] z-[70] w-[19.5rem] rounded-3xl p-2.5 ${
            dark ? "nrld-panel-blood" : "nr-glass-deep"
          }`}
        >
          <p
            className={`px-3 pb-1.5 pt-2 text-[0.58rem] font-extrabold uppercase tracking-[0.26em] ${
              dark ? "text-white/40" : "text-[#10161d]/40"
            }`}
          >
            explore
          </p>

          {ITEMS.map((it) => (
            <a
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={close}
              aria-current={isActive(it.href) ? "page" : undefined}
              className={`mt-0.5 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-200 ${
                dark
                  ? isActive(it.href)
                    ? "bg-white/10"
                    : "hover:bg-white/[0.06]"
                  : isActive(it.href)
                    ? "bg-[#10161d]/[0.06]"
                    : "hover:bg-[#10161d]/[0.045]"
              }`}
            >
              <span
                aria-hidden
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[0.85rem] ${
                  dark
                    ? isActive(it.href)
                      ? "bg-[#FF003C] text-white"
                      : "bg-white/10 text-white/80"
                    : isActive(it.href)
                      ? "bg-[#0a0a0a] text-white"
                      : "bg-[#10161d]/[0.05] text-[#10161d]/80"
                }`}
              >
                {it.icon}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[0.84rem] font-extrabold tracking-tight ${
                    dark ? "text-white" : "text-[#0a0a0a]"
                  }`}
                >
                  {it.label}
                  {isActive(it.href) && (
                    <span
                      aria-hidden
                      className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                        dark ? "bg-[#FF003C]" : "bg-[#3d7db8]"
                      }`}
                    />
                  )}
                </span>
                <span
                  className={`block truncate text-[0.64rem] font-semibold ${
                    dark ? "text-white/50" : "text-[#10161d]/50"
                  }`}
                >
                  {it.desc}
                </span>
              </span>
            </a>
          ))}

          {/* разделитель + кошелёк (MetaMask-сессия и invite-ссылка) */}
          <div aria-hidden className={`mx-3 my-2 h-px ${dark ? "bg-white/10" : "bg-[#10161d]/8"}`} />
          <div className="px-1.5 pb-1.5 pt-0.5">
            <p
              className={`px-1.5 pb-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.26em] ${
                dark ? "text-white/40" : "text-[#10161d]/40"
              }`}
            >
              wallet
            </p>
            <WalletButton />
          </div>
        </div>
      )}
    </div>
  );
}
