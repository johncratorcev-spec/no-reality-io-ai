"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import WalletButton from "@/components/wallet/WalletButton";

/* ================================================================
   Меню сайта — стилизованная кнопка-бургер в перламутровом стекле.

   Внутри — все «новые» разделы проекта (prompt market, collab,
   in future) + feed и сессия MetaMask. Кнопка морфит «бургер → ✕»,
   панель — стеклянная, светлая, с активной подсветкой раздела.

   Один компонент используется на всех страницах (feed, market,
   landing, collab, future), чтобы навигация была везде одинаковой.
   ================================================================ */

const ITEMS = [
  { href: "/feed", icon: "▸", label: "feed", desc: "the AI video feed" },
  { href: "/market", icon: "✦", label: "prompt market", desc: "buy the exact prompts" },
  { href: "/collab", icon: "🐾", label: "collab", desc: "cats & the charity drive" },
  { href: "/future", icon: "◑", label: "in future", desc: "roadmap — ending predictions" },
] as const;

export default function Menu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
      {/* --- кнопка-бургер: перламутровое стекло, линии морфят в ✕ --- */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="nr-glass-deep group inline-flex h-10 items-center gap-2 rounded-full px-3.5 transition-transform duration-300 hover:scale-[1.05] active:scale-95"
      >
        <span aria-hidden className="relative flex h-[14px] w-[18px] flex-col justify-between">
          <span
            className={`nr-burger-line ${open ? "translate-y-[6px] rotate-45" : ""}`}
          />
          <span
            className={`nr-burger-line ${open ? "scale-x-0 opacity-0" : ""}`}
          />
          <span
            className={`nr-burger-line ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
          />
        </span>
        <span className="hidden text-[0.68rem] font-extrabold tracking-tight text-[#10161d]/70 transition-colors group-hover:text-[#0a0a0a] sm:block">
          {open ? "close" : "menu"}
        </span>
      </button>

      {/* --- панель: светлое стекло, разделы + кошелёк --- */}
      {open && (
        <div
          role="menu"
          aria-label="Site menu"
          className="nr-menu-pop nr-glass-deep absolute right-0 top-[calc(100%+10px)] z-[70] w-[19.5rem] rounded-3xl p-2.5"
        >
          <p className="px-3 pb-1.5 pt-2 text-[0.58rem] font-extrabold uppercase tracking-[0.26em] text-[#10161d]/40">
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
                isActive(it.href)
                  ? "bg-[#10161d]/[0.06]"
                  : "hover:bg-[#10161d]/[0.045]"
              }`}
            >
              <span
                aria-hidden
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[0.85rem] ${
                  isActive(it.href)
                    ? "bg-[#0a0a0a] text-white"
                    : "bg-[#10161d]/[0.05] text-[#10161d]/80"
                }`}
              >
                {it.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.84rem] font-extrabold tracking-tight text-[#0a0a0a]">
                  {it.label}
                  {isActive(it.href) && (
                    <span
                      aria-hidden
                      className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#3d7db8] align-middle"
                    />
                  )}
                </span>
                <span className="block truncate text-[0.64rem] font-semibold text-[#10161d]/50">
                  {it.desc}
                </span>
              </span>
            </a>
          ))}

          {/* разделитель + кошелёк (MetaMask-сессия и invite-ссылка) */}
          <div aria-hidden className="mx-3 my-2 h-px bg-[#10161d]/8" />
          <div className="px-1.5 pb-1.5 pt-0.5">
            <p className="px-1.5 pb-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.26em] text-[#10161d]/40">
              wallet
            </p>
            <WalletButton />
          </div>
        </div>
      )}
    </div>
  );
}
