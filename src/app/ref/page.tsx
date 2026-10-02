"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * /ref — рефералка (ТЗ §Рефка).
 *
 * Ссылка есть у всех с регистрации: https://no-reality.fun/?ref=код.
 * До оплаты на ней «процент выключен»; разблокировка — разовые 3 USDT
 * (инвойс rev-<accountId>, paid ставит revshare). Дальше у пригласившего
 * 20% от КАЖДОЙ пачки реферала — в USDT (не из очков, под EYE не
 * допечатывается). Неоплаченный видит, сколько USDT сгорело по его
 * ссылке. Выигрыши рефералов в EYE — цифрой, в доллары не переводятся.
 * Выплата от 5 USDT, иначе копится.
 */

interface RefStats {
  code: string | null;
  link: string | null;
  revshare: boolean;
  earnedUsdtCents: number;
  burnedUsdtCents: number;
  paidUsdtCents: number;
  pendingUsdtCents: number;
  referrals: Array<{ name: string; eyeWon: number }>;
}

const usdt = (cents: number) => (cents / 100).toFixed(2);

export default function RefPage() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState<RefStats | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/me/ref", { cache: "no-store" });
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      const d = (await r.json()) as RefStats & { ok?: boolean };
      setAuthed(true);
      setStats(d);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unlock = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/me/ref", { method: "POST" });
      const d = (await r.json()) as { payUrl?: string; error?: string };
      if (!r.ok || d.error) {
        setError(d.error ?? "failed");
        return;
      }
      if (d.payUrl) {
        setPayUrl(d.payUrl);
        try {
          window.open(d.payUrl, "_blank", "noopener");
        } catch {
          /* попап заблокирован — кнопка-ссылка останется */
        }
      }
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const copyLink = useCallback(() => {
    if (!stats?.link) return;
    try {
      void navigator.clipboard.writeText(stats.link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = stats.link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [stats]);

  return (
    <main
      className="min-h-dvh px-4 pb-24 pt-8"
      style={{ background: "var(--nb-night, #0a080d)", color: "var(--nb-bone, #f2ede4)" }}
    >
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/bet"
          className="text-[0.68rem] font-black uppercase tracking-[0.24em]"
          style={{ color: "rgba(242,237,228,.5)" }}
        >
          ← no reality.
        </Link>

        <h1 className="mt-5 text-[1.7rem] font-black leading-tight">
          {t.bet.refUnlockTitle}
        </h1>
        <p className="mt-2 text-[0.78rem] font-semibold leading-relaxed" style={{ color: "rgba(242,237,228,.6)" }}>
          {t.bet.refUnlockBody}
        </p>

        {authed === false && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-[0.8rem] font-bold">{lang === "ru" ? "войди, чтобы получить свою ссылку" : "sign in to get your link"}</p>
            <Link
              href="/auth?next=/ref"
              className="nb-btn mt-4 inline-block rounded-full px-6 py-2.5 text-[0.8rem] font-black"
              style={{ background: "var(--nb-bone, #f2ede4)", color: "#0a080d" }}
            >
              {lang === "ru" ? "войти" : "sign in"}
            </Link>
          </div>
        )}

        {stats && (
          <>
            {/* ---- статус процента ---- */}
            <div
              className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.16em]"
              style={{
                background: stats.revshare ? "rgba(200,255,0,.12)" : "rgba(255,0,60,.1)",
                color: stats.revshare ? "var(--nb-poison, #c8ff00)" : "var(--nb-blood, #ff003c)",
                border: `1px solid ${stats.revshare ? "rgba(200,255,0,.35)" : "rgba(255,0,60,.35)"}`,
              }}
            >
              {stats.revshare ? t.bet.refOn : t.bet.refOff}
            </div>

            {/* ---- ссылка ---- */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(242,237,228,.45)" }}>
                {t.bet.refLinkTitle}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-[0.74rem] font-bold" style={{ color: "rgba(242,237,228,.8)" }}>
                  {stats.link ?? "—"}
                </code>
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 transition-transform hover:scale-105 active:scale-95"
                  aria-label={t.bet.refCopy}
                >
                  {copied ? <Check className="h-4 w-4" style={{ color: "var(--nb-poison, #c8ff00)" }} /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* ---- разблокировка ---- */}
            {!stats.revshare && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void unlock()}
                className="nb-btn mt-4 w-full rounded-full px-5 py-3.5 text-[0.85rem] font-black disabled:opacity-50"
                style={{ background: "var(--nb-poison, #c8ff00)", color: "#0a080d" }}
              >
                {busy ? "…" : t.bet.refPay}
              </button>
            )}
            {payUrl && (
              <a
                href={payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-center text-[0.7rem] font-bold underline underline-offset-4"
                style={{ color: "rgba(242,237,228,.6)" }}
              >
                {lang === "ru" ? "открыть инвойс" : "open invoice"}
              </a>
            )}
            {error && (
              <p className="mt-2 text-center text-[0.7rem] font-bold" style={{ color: "var(--nb-blood, #ff003c)" }}>
                {error}
              </p>
            )}

            {/* ---- деньги ---- */}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Stat label={t.bet.refEarned} value={`${usdt(stats.earnedUsdtCents)} USDT`} accent />
              <Stat label={t.bet.refPending} value={`${usdt(stats.pendingUsdtCents)} USDT`} />
              <Stat label={t.bet.refBurned} value={`${usdt(stats.burnedUsdtCents)} USDT`} />
              <Stat label={t.bet.refPaid} value={`${usdt(stats.paidUsdtCents)} USDT`} />
            </div>
            {!stats.revshare && stats.burnedUsdtCents > 0 && (
              <p className="mt-2 text-[0.66rem] font-bold leading-relaxed" style={{ color: "var(--nb-blood, #ff003c)" }}>
                {lang === "ru"
                  ? `по твоей ссылке сгорело ${usdt(stats.burnedUsdtCents)} USDT — включи процент, чтобы получать дальше.`
                  : `${usdt(stats.burnedUsdtCents)} USDT burned through your link — turn the percentage on to earn from now on.`}
              </p>
            )}

            {/* ---- выигрыши рефералов в EYE (цифрой, не в доллары) ---- */}
            <p className="mt-7 text-[0.6rem] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(242,237,228,.45)" }}>
              {t.bet.refReffs}
            </p>
            {stats.referrals.length === 0 ? (
              <p className="mt-2 text-[0.74rem] font-semibold" style={{ color: "rgba(242,237,228,.5)" }}>
                {t.bet.refNoRefs}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {stats.referrals.map((r) => (
                  <li
                    key={r.name}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
                  >
                    <span className="truncate text-[0.78rem] font-bold">{r.name}</span>
                    <span className="text-[0.78rem] font-black" style={{ color: "var(--nb-poison, #c8ff00)" }}>
                      +{r.eyeWon} EYE
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[0.56rem] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(242,237,228,.45)" }}>
        {label}
      </p>
      <p
        className="mt-1 text-[1.05rem] font-black leading-none"
        style={{ color: accent ? "var(--nb-poison, #c8ff00)" : "var(--nb-bone, #f2ede4)" }}
      >
        {value}
      </p>
    </div>
  );
}
