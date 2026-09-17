"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Loader2, PawPrint } from "lucide-react";
import { PARTNER_OF_WEEK } from "@/lib/site";
import { formatHMS, useCountdown } from "@/lib/charity";
import CharityModal from "./CharityModal";

/* ================================================================
   DonateBox — пилот крипто-доната 2328.io на постах партнёра
   недели (pawcrewdaily: главное видео коллаба + пост-пилот).
   До openingAtUtc донат «закрыт»: чип-таймер тикает, кнопка
   открывает модалку акции с отсчётом. После — обычный флоу:
   пресеты → hosted checkout 2328 (новая вкладка) → поллинг →
   «спасибо». Тёплый кошачий стиль.
   ================================================================ */

type Phase = "choose" | "creating" | "waiting" | "thanks" | "error";

const PRESET_LABEL: Record<string, string> = {
  "1.00": "a tuna treat",
  "3.00": "a bowl of milk",
  "5.00": "a full cat feast",
};

export default function DonateBox({ utmCode }: { utmCode: string }) {
  const presets = PARTNER_OF_WEEK.donatePresetsUsdt;
  const drive = PARTNER_OF_WEEK.charityDrive;
  const [open, setOpen] = useState(false);
  const [charityOpen, setCharityOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("choose");
  const [amount, setAmount] = useState<string>("");
  const [hint, setHint] = useState<string>("");
  const orderIdRef = useRef<string>("");
  const pollRef = useRef<number | null>(null);
  const { ready, msLeft, locked, opened } = useCountdown(drive.openingAtUtc);

  /* поллинг статуса: 4с × 150 попыток (10 мин), потом тихо сдаёмся */
  const startPolling = useCallback((orderId: string) => {
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries += 1;
      if (tries > 150) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        return;
      }
      try {
        const r = await fetch(
          `/api/donate/${utmCode}?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const d = (await r.json()) as { paid?: boolean; status?: string };
        if (d.paid) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setPhase("thanks");
        }
      } catch {
        /* сеть мигнула — попробуем на следующем тике */
      }
    }, 4000);
  }, [utmCode]);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    []
  );

  const donate = async () => {
    if (!amount || phase === "creating") return;
    setPhase("creating");
    setHint("");
    try {
      const r = await fetch(`/api/donate/${utmCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdt: amount }),
      });
      const d = (await r.json()) as { payUrl?: string; orderId?: string; error?: string };
      if (!r.ok || !d.payUrl || !d.orderId) {
        setPhase("choose");
        setHint(d.error || "could not open checkout — try again");
        return;
      }
      orderIdRef.current = d.orderId;
      window.open(d.payUrl, "_blank", "noopener,noreferrer");
      setPhase("waiting");
      startPolling(d.orderId);
    } catch {
      setPhase("choose");
      setHint("network hiccup — try again");
    }
  };

  const checkNow = async () => {
    setHint("checking…");
    try {
      const r = await fetch(
        `/api/donate/${utmCode}?orderId=${encodeURIComponent(orderIdRef.current)}`,
        { cache: "no-store" }
      );
      const d = (await r.json()) as { paid?: boolean; status?: string };
      if (d.paid) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setPhase("thanks");
      } else {
        setHint(`status: ${d.status ?? "pending"} — pay in the opened tab, then check again`);
      }
    } catch {
      setHint("status check failed — try again");
    }
  };

  const reset = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    setPhase("choose");
    setAmount("");
    setHint("");
  };

  return (
    <div className="absolute bottom-[6.4rem] right-3 z-20 flex flex-col items-end">
      {!open ? (
        <>
          {/* чип-таймер: тикающий отсчёт до открытия благотворительного доната */}
          {ready && locked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCharityOpen(true);
              }}
              aria-label="Charity drive — donations open soon, tap for details"
              className="nr-charity-chip mb-1.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.58rem] font-extrabold text-[#5b3013] transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <PawPrint className="h-3 w-3 text-[#c26d3f]" aria-hidden />
              <span>opens in</span>
              <span className="tabular-nums text-[#c26d3f]">
                {msLeft !== null ? formatHMS(msLeft) : "--:--:--"}
              </span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              /* пока акция закрыта — модалка с отсчётом; после — донат-флоу */
              if (ready && locked) setCharityOpen(true);
              else setOpen(true);
            }}
            aria-label="Make the world better — donate crypto to cat shelters"
            className="nr-donate-btn flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.68rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.05] active:scale-95"
          >
            <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
            make world better
          </button>
        </>
      ) : (
        <div
          role="dialog"
          aria-label="Donate crypto"
          className="nr-donate-card w-[13.5rem] rounded-3xl p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {phase === "thanks" ? (
            <div className="text-center">
              <p className="text-[0.82rem] font-extrabold text-[#3d2314]">
                meow-thank you! 🐾
              </p>
              <p className="mt-1 text-[0.6rem] font-semibold leading-relaxed text-[#6b4a33]/80">
                your crypto landed. the crew purrs in your honor.
              </p>
              <p className="mt-1 text-[0.56rem] font-bold text-[#c26d3f]">
                every cent goes to cat shelters 🐾
              </p>
              <button
                onClick={reset}
                className="mt-2.5 text-[0.62rem] font-extrabold text-[#c26d3f] hover:underline"
              >
                close
              </button>
            </div>
          ) : (
            <>
              <p className="text-[0.7rem] font-extrabold text-[#3d2314]">
                treat the crew 🐾
              </p>
              <p className="mt-0.5 text-[0.58rem] font-semibold text-[#6b4a33]/75">
                crypto (USDT) via 2328.io — you pick the coin &amp; network
              </p>

              <button
                onClick={() => setCharityOpen(true)}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-[#3d2314]/8 py-1 text-[0.55rem] font-extrabold text-[#c26d3f] transition-colors duration-200 hover:bg-[#3d2314]/15"
              >
                <PawPrint className="h-2.5 w-2.5" aria-hidden />
                charity drive: 100% to cat shelters
              </button>

              <div className="mt-2.5 flex flex-col gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(p)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-[0.68rem] font-extrabold transition-all duration-200 ${
                      amount === p
                        ? "bg-[#3d2314] text-[#ffe9d4]"
                        : "bg-white/70 text-[#3d2314] hover:bg-white"
                    }`}
                  >
                    <span>${p.replace(/\.00$/, "")}</span>
                    <span className="text-[0.56rem] font-bold opacity-70">
                      {PRESET_LABEL[p] ?? "usdt"}
                    </span>
                  </button>
                ))}
              </div>

              {phase === "waiting" ? (
                <button
                  onClick={checkNow}
                  className="mt-2.5 w-full rounded-xl bg-[#e4713b] px-3 py-2 text-[0.68rem] font-extrabold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-95"
                >
                  i paid — check it
                </button>
              ) : (
                <button
                  onClick={donate}
                  disabled={!amount || phase === "creating"}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#e4713b] px-3 py-2 text-[0.68rem] font-extrabold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-45"
                >
                  {phase === "creating" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      opening…
                    </>
                  ) : (
                    "open checkout"
                  )}
                </button>
              )}

              {phase === "waiting" && (
                <p className="mt-1.5 text-center text-[0.54rem] font-semibold text-[#6b4a33]/70">
                  checkout opened in a new tab — we poll the provider
                </p>
              )}
              {hint && (
                <p className="mt-1.5 text-center text-[0.54rem] font-semibold leading-snug text-[#c26d3f]">
                  {hint}
                </p>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="mt-1.5 w-full text-center text-[0.56rem] font-extrabold text-[#6b4a33]/60 hover:text-[#6b4a33]"
              >
                not now
              </button>
            </>
          )}
        </div>
      )}

      {/* модалка благотворительной акции — портал в body */}
      <CharityModal
        open={charityOpen}
        onClose={() => setCharityOpen(false)}
        onDonate={() => {
          setCharityOpen(false);
          setOpen(true);
        }}
      />
    </div>
  );
}
