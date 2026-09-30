"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Gift, Eye, Target, Video, X, Zap } from "lucide-react";
import { BET, fmtUsd } from "@/lib/bet/config";
import {
  DEPOSIT_PRESETS_CENTS,
  DEPOSIT_BONUS_PCTS,
  DAILY_BONUS_CENTS,
  GUESS_REWARD_CENTS,
  VIDEO_REWARD_CENTS,
  WATCH_REWARD_CENTS,
  WATCH_REWARD_EVERY_CLIPS,
  fmtCoins,
} from "@/lib/econ";
import { track } from "@/lib/bet/trackClient";
import { FEATURES } from "@/lib/features";
import type { RoundView } from "@/lib/bet/roundView";
import type { AccountView } from "@/hooks/use-account";
import { useLang } from "@/lib/i18n";

/**
 * PredictModal (v7) — модалка предикта: последняя ступень воронки.
 *
 * bet-режим:   выбор суммы → ставка ВИРТУАЛЬНЫМИ МОНЕТАМИ (мгновенно,
 *              без крипты — реальные ставки сняты с производства в v7).
 * topup-режим: не хватает монет → пополнение USDT (2328.io, строго крипта).
 *              Внутренний баланс — источник истины ПОСЛЕ удачного ответа
 *              вебхука: модалка поллит статус инвойса, и как только webhook
 *              зачислил деньги — выбранная ставка дожимается автоматически.
 *              v7: пакеты несут бонус-мультипликатор монет (+10%/+25%).
 * v8: награды за активность (просмотр ленты / угадывания / добавление видео)
 *      приходят сами — блок «earn coins» вместо Instagram-задания.
 *
 * Воронка (v8): никаких email-подтверждений и никаких крипто-кошельков — вход
 * своя форма (email+пароль) или Google, оба опциональны, ставка работает
 * у мгновенного гостя.
 */

type Side = "real" | "synth";

interface PredictModalProps {
  roundId: string;
  clipCode: string;
  /** null = открыта только для пополнения (без ставки) */
  side: Side | null;
  account: AccountView | null;
  onClose: () => void;
  /** ставка прошла — панель обновляет раунд/пул */
  onPlaced: (resp: PlacedResponse) => void;
  onAccountUpdate: (a: AccountView) => void;
}

interface PlacedResponse {
  bet_id: string;
  status: string;
  mode: string;
  balance_cents?: number;
  account?: AccountView;
  round?: RoundView | null;
  error?: string;
}

const POLL_MS = 2500;
const POLL_MAX = 150_000;

export default function PredictModal({
  roundId,
  clipCode,
  side,
  account,
  onClose,
  onPlaced,
  onAccountUpdate,
}: PredictModalProps) {
  const { t } = useLang();
  const [mode, setMode] = useState<"bet" | "topup">(side ? "bet" : "topup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [deposit, setDeposit] = useState<{ orderId: string; payUrl: string | null; mode: string } | null>(null);
  const [depositStatus, setDepositStatus] = useState<string>("pending");
  const [awaitingNetwork, setAwaitingNetwork] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef = useRef(true);

  const balance = account?.balanceCents ?? 0;
  const pendingSide = side ?? "real";

  useEffect(() => {
    aliveRef.current = true;
    track("predict_modal_open", clipCode, { side, mode: side ? "bet" : "topup" });
    return () => {
      aliveRef.current = false;
    };
  }, [clipCode, side]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPoll, [stopPoll]);

  const placeBet = useCallback(
    async (amountCents: number) => {
      setBusy(true);
      setError("");
      track("funnel_confirm", clipCode, { side: pendingSide, amount: amountCents });
      try {
        const ref = (() => {
          try {
            return localStorage.getItem("nr-ref");
          } catch {
            return null;
          }
        })();
        const r = await fetch("/api/bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            round_id: roundId,
            side: pendingSide,
            amount_cents: amountCents,
            mode: "balance",
            ref,
          }),
        });
        const d = (await r.json()) as PlacedResponse & { account?: AccountView };
        if (!r.ok || d.error) {
          if (d.error === "insufficient_balance") {
            setPendingAmount(amountCents);
            setMode("topup");
            track("funnel_insufficient", clipCode, { amount: amountCents });
            return;
          }
          if (d.error === "already_bet") setError(t.bet.alreadyBet);
          else if (d.error === "round_closed") setError(t.bet.roundClosed);
          else setError(t.bet.betRejected);
          return;
        }
        if (d.account) onAccountUpdate(d.account);
        onPlaced(d);
      } catch {
        setError(t.bet.networkDown);
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    },
    [roundId, clipCode, pendingSide, onAccountUpdate, onPlaced, t]
  );

  /** авто-дожим ставки после зачисления баланса (вебхук → источник истины) */
  const tryAutoBet = useCallback(
    (fresh: AccountView) => {
      const wanted = pendingAmount;
      if (wanted == null || !side) return;
      if (fresh.balanceCents >= wanted) {
        setPendingAmount(null);
        void placeBet(wanted);
      }
    },
    [pendingAmount, side, placeBet]
  );

  const startDeposit = useCallback(
    async (amountCents: number) => {
      setBusy(true);
      setError("");
      track("topup_open", clipCode, { amount: amountCents });
      try {
        const r = await fetch("/api/wallet/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount_cents: amountCents }),
        });
        const d = (await r.json()) as {
          order_id?: string;
          pay_url?: string | null;
          mode?: string;
          account?: AccountView;
          error?: string;
        };
        if (!r.ok || d.error) {
          setError(d.error === "demo_cap" ? t.bet.demoCap : t.bet.invoiceFailed);
          return;
        }
        if (d.account) onAccountUpdate(d.account);

        if (d.mode === "demo") {
          /* sandbox: деньги уже на балансе — дожимаем ставку сразу */
          setDepositStatus("paid");
          if (d.account) tryAutoBet(d.account);
          return;
        }

        setDeposit({ orderId: d.order_id ?? "", payUrl: d.pay_url ?? null, mode: "crypto" });
        setDepositStatus("pending");
        setAwaitingNetwork(true);
        if (d.pay_url) {
          try {
            window.open(d.pay_url, "_blank", "noopener");
          } catch {
            /* попап заблокирован — кнопка «оплатить» останется в модалке */
          }
        }

        /* поллинг статуса: зачисление делает ТОЛЬКО подписанный webhook;
           как только баланс вырос — источник истины подтверждён */
        stopPoll();
        const started = Date.now();
        pollRef.current = setInterval(async () => {
          if (!aliveRef.current || !d.order_id) {
            stopPoll();
            return;
          }
          if (Date.now() - started > POLL_MAX) {
            stopPoll();
            setAwaitingNetwork(false);
            setError(t.bet.invoiceExpired);
            return;
          }
          try {
            const pr = await fetch(`/api/wallet/deposit?order=${encodeURIComponent(d.order_id!)}`, {
              cache: "no-store",
            });
            const pd = (await pr.json()) as { status?: string; balanceCents?: number };
            if (pd.status === "paid") {
              stopPoll();
              setDepositStatus("paid");
              setAwaitingNetwork(false);
              const fresh = await fetch("/api/me", { cache: "no-store" })
                .then((x) => x.json() as Promise<{ account?: AccountView }>)
                .catch(() => ({ account: null }));
              if (fresh.account) {
                onAccountUpdate(fresh.account);
                tryAutoBet(fresh.account);
              }
            }
          } catch {
            /* сеть моргнула — следующий тик */
          }
        }, POLL_MS);
      } catch {
        setError(t.bet.networkDown);
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    },
    [clipCode, onAccountUpdate, tryAutoBet, stopPoll, t]
  );

  const claimDaily = useCallback(async () => {
    const r = await fetch("/api/me/daily", { method: "POST" });
    const d = (await r.json()) as { credited?: boolean; account?: AccountView };
    if (d.account) onAccountUpdate(d.account);
  }, [onAccountUpdate]);

  const pickAmount = (amountCents: number) => {
    if (amountCents > balance) {
      setPendingAmount(amountCents);
      setMode("topup");
      track("funnel_insufficient", clipCode, { amount: amountCents });
      return;
    }
    void placeBet(amountCents);
  };

  /* ---------- рендер ---------- */
  const accent =
    pendingSide === "real" ? "var(--nb-poison)" : "var(--nb-blood)";
  const accentBg = pendingSide === "real" ? "rgba(200,255,0,.12)" : "rgba(255,0,60,.14)";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="prediction"
    >
      {/* фон */}
      <button
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(4,3,8,.72)", backdropFilter: "blur(3px)" }}
      />

      {/* лист */}
      <div
        className="nb-panel relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:rounded-3xl"
        style={{ animation: "nb-sheet-up .28s cubic-bezier(.2,.9,.3,1) both" }}
      >
        {/* хват сверху (мобайл) */}
        <div
          aria-hidden
          className="mx-auto mb-3 h-1 w-10 rounded-full sm:hidden"
          style={{ background: "rgba(242,237,228,.25)" }}
        />

        {/* шапка */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[0.58rem] font-black uppercase tracking-[0.28em]"
              style={{ color: "rgba(242,237,228,.45)" }}
            >
              {mode === "topup" ? t.bet.topupBalance : t.bet.yourPredict}
            </p>
            {mode === "bet" ? (
              <p className="mt-1 flex items-center gap-2 text-[1.3rem] font-black leading-none">
                <span
                  className="rounded-lg px-2 py-1 text-[0.8rem]"
                  style={{ background: accentBg, color: accent }}
                >
                  {pendingSide.toUpperCase()}
                </span>
                <span style={{ color: "var(--nb-bone)" }}>{fmtUsd(BET.minBetCents)}–{fmtUsd(BET.maxBetCents)}</span>
                <span className="text-[0.62rem] font-bold" style={{ color: "rgba(242,237,228,.45)" }}>
                  {t.bet.coins}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[1.05rem] font-black leading-tight" style={{ color: "var(--nb-bone)" }}>
                {t.bet.topupSub}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2"
            style={{ color: "rgba(242,237,228,.55)" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* строка баланса */}
        <div
          className="mt-4 flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5"
          style={{ background: "rgba(242,237,228,.05)", border: "1px solid rgba(242,237,228,.12)" }}
        >
          <span className="flex items-center gap-2 text-[0.8rem] font-extrabold" style={{ color: "rgba(242,237,228,.75)" }}>
            <Coins className="h-4 w-4" style={{ color: "var(--nb-poison)" }} />
            {t.bet.balance}
          </span>
          <span className="flex items-center gap-2">
            {account?.isPass && (
              <span
                className="rounded-full px-2 py-0.5 text-[0.56rem] font-black tracking-[0.16em]"
                style={{ background: "rgba(200,255,0,.14)", color: "var(--nb-poison)" }}
              >
                PASS
              </span>
            )}
            <span className="text-[1.05rem] font-black" style={{ color: "var(--nb-bone)" }}>
              {fmtCoins(balance)}
            </span>
          </span>
        </div>

        {/* ---- bet: пресеты суммы ---- */}
        {mode === "bet" && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {BET.betPresetsCents.map((c) => {
              const afford = c <= balance;
              return (
                <button
                  key={c}
                  disabled={busy}
                  onClick={() => pickAmount(c)}
                  className="nb-btn rounded-2xl px-2 py-4 text-[1.1rem] font-black disabled:opacity-60"
                  style={{
                    border: `1px solid ${afford ? accent : "rgba(242,237,228,.16)"}`,
                    color: afford ? accent : "rgba(242,237,228,.38)",
                    background: afford ? accentBg : "rgba(242,237,228,.03)",
                  }}
                >
                  {fmtUsd(c)}
                </button>
              );
            })}
          </div>
        )}

        {/* ---- topup: платежи выключены приказом — показываем, как заработать EYE ---- */}
        {mode === "topup" && !FEATURES.payments && (
          <div
            className="mt-4 rounded-2xl px-3.5 py-3"
            style={{ border: "1px dashed rgba(200,255,0,.3)", background: "rgba(200,255,0,.05)" }}
          >
            <p className="text-[0.74rem] font-black" style={{ color: "var(--nb-poison)" }}>
              {t.bet.earnTitle}
            </p>
            <p className="mt-1.5 text-[0.7rem] font-semibold leading-relaxed" style={{ color: "rgba(242,237,228,.6)" }}>
              {t.bet.earnBody}
            </p>
          </div>
        )}

        {/* ---- topup: пресеты пополнения с мультипликатором + статус ---- */}
        {mode === "topup" && FEATURES.payments && (
          <div className="mt-4">
            {!deposit && (
              <>
                <p className="text-[0.72rem] font-bold" style={{ color: "rgba(242,237,228,.6)" }}>
                  {t.bet.cryptoOnly}
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {DEPOSIT_PRESETS_CENTS.map((c, i) => {
                    const pct = DEPOSIT_BONUS_PCTS[i] ?? 0;
                    const isBest = pct === Math.max(...DEPOSIT_BONUS_PCTS) && pct > 0;
                    return (
                      <button
                        key={c}
                        disabled={busy}
                        onClick={() => void startDeposit(c)}
                        className="nb-btn nb-btn-real relative rounded-2xl px-2 py-4 text-[1.05rem] font-black"
                      >
                        {fmtUsd(c)}
                        {pct > 0 && (
                          <span
                            className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.52rem] font-black tracking-[0.08em]"
                            style={{
                              background: "var(--nb-poison)",
                              color: "#0a080d",
                            }}
                          >
                            +{pct}%{isBest ? ` · ${t.bet.bestRate}` : ""}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {deposit && depositStatus === "pending" && (
              <div className="mt-3 flex flex-col items-center gap-2.5 py-2 text-center">
                <Zap className="h-5 w-5 animate-pulse" style={{ color: "var(--nb-poison)" }} />
                <p className="text-[0.82rem] font-black" style={{ color: "var(--nb-bone)" }}>
                  {t.bet.awaitingNetwork}
                </p>
                <p className="text-[0.66rem] font-bold" style={{ color: "rgba(242,237,228,.55)" }}>
                  {t.bet.topupHint}
                </p>
                {deposit.payUrl && (
                  <a
                    href={deposit.payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nb-btn mt-1 rounded-full px-5 py-2.5 text-[0.78rem] font-black"
                    style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
                  >
                    {t.bet.openInvoice}
                  </a>
                )}
              </div>
            )}

            {depositStatus === "paid" && (
              <p className="mt-3 text-center text-[0.85rem] font-black" style={{ color: "var(--nb-poison)" }}>
                {t.bet.topupDone}
              </p>
            )}
          </div>
        )}

        {/* ошибка */}
        {error && (
          <p className="mt-2.5 text-[0.72rem] font-bold" style={{ color: "var(--nb-blood)" }}>
            {error}
          </p>
        )}

        {/* PASS-плашка daily */}
        {account?.isPass && account.dailyAvailable && (
          <button
            onClick={() => void claimDaily()}
            className="nb-btn mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[0.74rem] font-black"
            style={{ background: "rgba(200,255,0,.1)", color: "var(--nb-poison)", border: "1px solid rgba(200,255,0,.3)" }}
          >
            <Gift className="h-4 w-4" />
            {t.bet.dailyPassBonus}{fmtCoins(DAILY_BONUS_CENTS)}
          </button>
        )}

        {/* ---------- v8: как заработать монет (вместо IG-задания) ---------- */}
        <div
          className="mt-3 rounded-2xl px-3.5 py-3"
          style={{ border: "1px dashed rgba(200,255,0,.3)", background: "rgba(200,255,0,.05)" }}
        >
          <p className="flex items-center gap-2 text-[0.72rem] font-black uppercase tracking-[0.14em]" style={{ color: "var(--nb-poison)" }}>
            <Zap className="h-3.5 w-3.5" />
            {t.bet.earnTitle}
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-center gap-2 text-[0.68rem] font-bold" style={{ color: "rgba(242,237,228,.8)" }}>
              <Eye className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--nb-bone)" }} />
              <span>
                {t.bet.earnWatch
                  .replace("{N}", fmtCoins(WATCH_REWARD_CENTS))
                  .replace("{every}", String(WATCH_REWARD_EVERY_CLIPS))}
              </span>
            </li>
            <li className="flex items-center gap-2 text-[0.68rem] font-bold" style={{ color: "rgba(242,237,228,.8)" }}>
              <Target className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--nb-bone)" }} />
              <span>{t.bet.earnGuess.replace("{N}", fmtCoins(GUESS_REWARD_CENTS))}</span>
            </li>
            <li className="flex items-center gap-2 text-[0.68rem] font-bold" style={{ color: "rgba(242,237,228,.8)" }}>
              <Video className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--nb-bone)" }} />
              <span>{t.bet.earnVideo.replace("{N}", fmtCoins(VIDEO_REWARD_CENTS))}</span>
            </li>
          </ul>
        </div>

        {/* футер-примечание */}
        <p className="mt-3 text-center text-[0.6rem] font-bold leading-relaxed" style={{ color: "rgba(242,237,228,.38)" }}>
          {t.bet.noWalletNote}
        </p>
      </div>
    </div>
  );
}
