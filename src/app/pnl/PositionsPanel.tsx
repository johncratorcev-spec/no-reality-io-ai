"use client";

import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";

/* ================================================================
   POSITIONS PANEL (/pnl) — все позиции игрока REAL/SYNTH.

   Читает GET /api/me/bets: ставки + claimable-сводка. Кэшаут —
   POST /api/me/cashout { wallet } → 2328.io Payout (USDT, сеть по
   формату адреса). Одна выплата закрывает все won & !claimed.

   Motion: LazyMotion domAnimation (~5kb, transform/opacity only),
   stagger-всплытие строк, spring на claimable, prefers-reduced-
   motion уважается самим motion (useReducedMotion внутри).
   Тон: руби, без welcome-сообщений.
   ================================================================ */

interface BetRow {
  id: string;
  clip: string;
  side: "real" | "synth";
  amountCents: number;
  status: string;
  payoutCents: number | null;
  mode: string;
  claimed: boolean;
  roundStatus: string;
  resolvedAs: string | null;
  createdAt: string;
}

interface BetsPayload {
  bets: BetRow[];
  claimableCents: number;
  claimedTotalCents: number;
  payoutsEnabled: boolean;
}

function fmtUsd(cents: number): string {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

const STATUS_LABEL: Record<string, string> = {
  active: "in the pool",
  pending: "awaiting payment",
  won: "won",
  lost: "lost",
  late: "late — refund",
  failed: "payment failed",
};

const STATUS_COLOR: Record<string, string> = {
  active: "text-white",
  pending: "text-[#d9a441]",
  won: "text-[#57d98a]",
  lost: "text-[#ff4d6e]",
  late: "text-[#d9a441]",
  failed: "text-white/40",
};

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function PositionsPanel() {
  const [data, setData] = useState<BetsPayload | null>(null);
  const [state, setState] = useState<"loading" | "empty" | "ready" | "down">("loading");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/me/bets", { cache: "no-store" });
      const j = (await r.json()) as BetsPayload;
      if (!j.bets || j.bets.length === 0) {
        setState("empty");
        return;
      }
      setData(j);
      setState("ready");
    } catch {
      setState("down");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cashout = async () => {
    if (busy || !data) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/me/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.trim() }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        amountCents?: number;
        network?: string;
        claimableCents?: number;
      };
      if (r.ok && j.ok) {
        setMsgOk(true);
        setMsg(
          `payout sent — ${fmtUsd(j.amountCents ?? 0)} via ${(j.network ?? "2328.io").toUpperCase()}. watch your wallet.`
        );
        setWallet("");
        await load();
      } else {
        setMsgOk(false);
        setMsg(j.error ?? "cashout failed — try again");
      }
    } catch {
      setMsgOk(false);
      setMsg("cashout failed — the ledger is unreachable");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="nrld-panel rounded-3xl px-6 py-10 text-center text-white/40">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.24em]">
          reading the ledger…
        </p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="nrld-panel-blood rounded-3xl px-6 py-10 text-center">
        <p className="nrld-num text-2xl font-extrabold text-white">no positions yet</p>
        <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-white/60">
          the ledger is empty. go watch something that shouldn&apos;t exist —
          and call it. real or synth, $1 is enough.
        </p>
        <a
          href="/feed"
          className="nrld-btn-blood nrld-tap mt-5 inline-flex rounded-full px-6 py-2.5 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-white"
        >
          bet the seam
        </a>
      </div>
    );
  }

  if (state === "down" || !data) {
    return (
      <div className="nrld-panel rounded-3xl px-6 py-10 text-center text-white/40">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.24em]">
          the ledger is unreachable right now — your positions are safe.
        </p>
      </div>
    );
  }

  const claimable = data.claimableCents;
  const canCashout = data.payoutsEnabled && claimable > 0;

  return (
    <LazyMotion features={domAnimation} strict>
      {/* ---- claimable: доступно к выводу ---- */}
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="nrld-panel-blood rounded-3xl p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.28em] text-[#ff4d6e]">
              claimable
            </p>
            <m.p
              key={claimable}
              initial={{ scale: claimable > 0 ? 1.12 : 1, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="nrld-num mt-1 text-4xl font-extrabold leading-none text-white"
            >
              {fmtUsd(claimable)}
            </m.p>
            <p className="mt-1.5 font-mono text-[0.62rem] text-white/45">
              paid out so far: {fmtUsd(data.claimedTotalCents)} · min cash-out {fmtUsd(100)}
            </p>
          </div>
          {!data.payoutsEnabled && claimable > 0 && (
            <p className="max-w-[16rem] text-[0.66rem] font-semibold leading-snug text-white/50">
              crypto payouts switch on with the 2328 payout keys — your winnings
              stay on the ledger until then.
            </p>
          )}
        </div>

        {/* ---- кэшаут: кошелёк + кнопка ---- */}
        <AnimatePresence initial={false}>
          {canCashout && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: easeOut }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="USDT wallet — T… (TRC20) or 0x… (ERC20)"
                  spellCheck={false}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-3 font-mono text-[0.78rem] text-white placeholder:text-white/30 focus:border-[#ff003c]/60 focus:outline-none"
                />
                <button
                  onClick={cashout}
                  disabled={busy || wallet.trim().length < 30}
                  className="nrld-btn-blood nrld-tap rounded-xl px-6 py-3 text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {busy ? "sending…" : "cash out"}
                </button>
              </div>
              <AnimatePresence>
                {msg && (
                  <m.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`mt-2 text-[0.72rem] font-semibold ${msgOk ? "text-[#57d98a]" : "text-[#ff4d6e]"}`}
                  >
                    {msg}
                  </m.p>
                )}
              </AnimatePresence>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>

      {/* ---- список позиций ---- */}
      <div className="mt-4 flex flex-col gap-2.5">
        {data.bets.map((b, i) => (
          <m.div
            key={b.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: Math.min(i * 0.05, 0.4) }}
            className="nrld-panel flex items-center gap-3 rounded-2xl px-4 py-3"
          >
            <span
              className={`shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] ${
                b.side === "real"
                  ? "border border-white/25 bg-white/10 text-white"
                  : "bg-[#ff003c]/15 text-[#ff4d6e]"
              }`}
            >
              {b.side}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.78rem] font-extrabold text-white">
                {b.clip}
              </p>
              <p className="mt-0.5 font-mono text-[0.6rem] text-white/40">
                {new Date(b.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {b.mode}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-[0.7rem] font-extrabold ${STATUS_COLOR[b.status] ?? "text-white"}`}>
                {STATUS_LABEL[b.status] ?? b.status}
              </p>
              <p className="nrld-num mt-0.5 text-[0.78rem] font-extrabold text-white">
                {b.status === "won" && b.payoutCents
                  ? `+${fmtUsd(b.payoutCents)}`
                  : fmtUsd(b.amountCents)}
                {b.status === "won" && b.claimed && (
                  <span className="ml-1.5 text-[0.56rem] font-bold uppercase tracking-[0.14em] text-white/35">
                    paid
                  </span>
                )}
              </p>
            </div>
          </m.div>
        ))}
      </div>

      <p className="mt-3 text-center text-[0.62rem] font-semibold text-white/35">
        last 30 positions · winnings pay out in USDT via 2328.io
      </p>
    </LazyMotion>
  );
}
