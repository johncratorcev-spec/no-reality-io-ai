"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

/**
 * v14 — /claim: адрес для merkle-клейма $NR (ТЗ §Раздача $NR).
 *
 * «$NR получает тот, кто увидел раньше зала.» Адрес принимается ТОЛЬКО
 * на этом домене и ТОЛЬКО после снапшота сезона. До клейма публичны
 * только ранг и число ранних верных коллов — число монет не показывается
 * никому (сервер его не отдаёт — /api/me/nr).
 */

interface NrView {
  season: { code: string; endsAt: string } | null;
  snapshotDone: boolean;
  rank: number | null;
  correctRounds: number;
  earlyCorrect: number;
  qualifies: boolean;
  address: string | null;
}

export default function ClaimPage() {
  const { lang } = useLang();
  const ru = lang === "ru";
  const [nr, setNr] = useState<NrView | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/me/nr", { cache: "no-store" });
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      const d = (await r.json()) as NrView & { ok?: boolean };
      setAuthed(true);
      setNr(d);
      if (d.address) setDone(d.address);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/me/nr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; address?: string };
      if (r.ok && d.ok) {
        setDone(d.address ?? address.trim().toLowerCase());
      } else {
        setError(
          d.error === "snapshot_pending"
            ? ru ? "Снапшот ещё не прошёл — адрес примем после него." : "snapshot pending — come back after it"
            : d.error === "already_registered"
              ? ru ? "Адрес уже зарегистрирован." : "address already registered"
              : d.error === "address_taken"
                ? ru ? "Этот адрес уже занят другим аккаунтом." : "address already taken"
                : ru ? "Проверь адрес (0x…, Base)." : "check the address (0x…, Base)"
        );
      }
    } catch {
      setError(ru ? "Сеть подвела. Попробуй ещё." : "network error, try again");
    } finally {
      setBusy(false);
    }
  }, [address, ru]);

  return (
    <main
      className="min-h-screen w-full px-5 pb-16 pt-24"
      style={{ background: "var(--nb-night, #0b0b0d)", color: "var(--nb-bone, #f2ede4)" }}
    >
      <div className="mx-auto w-full max-w-md">
        <p className="text-[0.6rem] font-black uppercase tracking-[0.3em]" style={{ color: "rgba(242,237,228,.45)" }}>
          $NR · base
        </p>
        <h1 className="mt-2 text-3xl font-black leading-none tracking-tight">
          {ru ? "увидел раньше зала — забери." : "saw it before the crowd — take it."}
        </h1>
        <p className="mt-3 text-[0.8rem] font-semibold leading-relaxed" style={{ color: "rgba(242,237,228,.6)" }}>
          {ru
            ? "$NR получает тот, кто увидел раньше зала. Угадал в конце — почти ноль. Не угадал — ноль. Курс не обещаем."
            : "$NR goes to whoever saw it before the crowd. a late call is worth almost nothing. a wrong call — nothing. no rate promised."}
        </p>

        {authed === false && (
          <Link
            href="/auth?next=/claim"
            className="nb-btn mt-6 block rounded-full px-4 py-3 text-center text-[0.74rem] font-bold"
            style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
          >
            {ru ? "войти, чтобы заявить адрес" : "sign in to claim"}
          </Link>
        )}

        {nr && (
          <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "rgba(242,237,228,.14)" }}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-black">{nr.rank ?? "—"}</p>
                <p className="text-[0.56rem] font-bold uppercase tracking-[0.18em] opacity-50">{ru ? "ранг" : "rank"}</p>
              </div>
              <div>
                <p className="text-2xl font-black">{nr.correctRounds}</p>
                <p className="text-[0.56rem] font-bold uppercase tracking-[0.18em] opacity-50">{ru ? "верных раундов" : "correct"}</p>
              </div>
              <div>
                <p className="text-2xl font-black">{nr.earlyCorrect}</p>
                <p className="text-[0.56rem] font-bold uppercase tracking-[0.18em] opacity-50">{ru ? "ранних коллов" : "early"}</p>
              </div>
            </div>
            {nr.snapshotDone ? (
              done ? (
                <p className="mt-4 break-all text-center text-[0.72rem] font-bold" style={{ color: "var(--nb-lime, #b6f34a)" }}>
                  ✓ {done}
                </p>
              ) : (
                <div className="mt-4">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0x…"
                    spellCheck={false}
                    className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-[0.8rem] font-bold outline-none"
                    style={{ borderColor: "rgba(242,237,228,.2)" }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={submit}
                    className="nb-btn mt-2 w-full rounded-full px-4 py-2.5 text-[0.72rem] font-bold disabled:opacity-50"
                    style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
                  >
                    {ru ? "заявить адрес · один раз" : "register address · once"}
                  </button>
                </div>
              )
            ) : (
              <p className="mt-4 text-center text-[0.66rem] font-bold uppercase tracking-[0.16em] opacity-60">
                {ru ? `адрес — после снапшота · ${new Date(nr.season?.endsAt ?? "").toLocaleString("ru-RU")}` : `address opens after snapshot · ${nr.season?.endsAt ?? ""}`}
              </p>
            )}
            {error && (
              <p className="mt-2 text-center text-[0.66rem] font-bold" style={{ color: "var(--nb-blood, #ff4d4d)" }}>
                {error}
              </p>
            )}
            <p className="mt-3 text-center text-[0.6rem] leading-relaxed opacity-45">
              {ru
                ? "число монет не публикуется никому — только merkle-клейм в сети."
                : "coin amounts are public to no one — only the merkle claim on-chain."}
            </p>
          </div>
        )}

        <Link href="/bet" className="mt-6 block text-center text-[0.68rem] font-bold underline underline-offset-4 opacity-70">
          ← {ru ? "назад к раундам" : "back to the rounds"}
        </Link>
      </div>
    </main>
  );
}
