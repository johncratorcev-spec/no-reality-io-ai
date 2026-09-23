"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, LockOpen, TriangleAlert } from "lucide-react";
import { formatUsd } from "@/lib/market/catalog";

/* ================================================================
   UnlockPanel — /market/thanks?session_id=cs_…

   Поллит /api/market/session-status (только СВОЙ заказ: cookie
   nr_buyer проверяется на сервере). Полный текст промпта показываем
   исключительно при paid. Реконсиляция на сервере догоняет оплату,
   даже если webhook запаздывал — обычно статус приходит мгновенно,
   поллинг оставлен как UX-страховка.
   ================================================================ */

interface StatusData {
  status: string;
  paid: boolean;
  item?: { code: string; title: string; category: string; priceCents: number };
  prompt?: string | null;
}

const POLL_MS = 2500;
const MAX_ATTEMPTS = 60; // ~2.5 мин, дальше — честная ошибка с ретраем

export default function UnlockPanel({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<
    "loading" | "pending" | "paid" | "notfound" | "error"
  >(sessionId ? "loading" : "notfound");
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    attempts.current += 1;
    try {
      const r = await fetch(
        `/api/market/session-status?id=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" }
      );
      const d = (await r.json()) as StatusData & { error?: string };
      if (r.status === 404) {
        setState("notfound");
        return;
      }
      if (!r.ok) throw new Error(d.error || `status ${r.status}`);
      setData(d);
      if (d.paid) {
        setState("paid");
        return;
      }
      setState("pending");
    } catch {
      /* одиночный сетевой сбой терпим — добираем до MAX_ATTEMPTS */
    }
    if (attempts.current < MAX_ATTEMPTS) {
      timer.current = setTimeout(poll, POLL_MS);
    } else {
      setError("Still waiting for confirmation — try again in a minute");
      setState("error");
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sessionId, poll]);

  const copyPrompt = async () => {
    if (!data?.prompt) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard запрещён — текст выделяется вручную */
    }
  };

  /* ---------------- рендер ---------------- */

  if (!sessionId) {
    return (
      <Shell>
        <p className="text-[0.86rem] font-semibold text-[#10161d]/60">
          no session id in the link — open your checkout again from the{" "}
          <a href="/market" className="underline underline-offset-4">
            prompt market
          </a>
          .
        </p>
      </Shell>
    );
  }

  if (state === "paid" && data?.item) {
    return (
      <Shell>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#2fa46a]/12 px-4 py-1.5 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-[#2fa46a]">
          <LockOpen className="h-3.5 w-3.5" aria-hidden />
          payment confirmed
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#10161d] sm:text-4xl">
          {data.item.title}
        </h2>
        <p className="mt-1 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#6d4fc2]">
          {data.item.category} · {formatUsd(data.item.priceCents)}
        </p>

        <div className="mt-6 rounded-2xl bg-[#f7f5fb] p-4 ring-1 ring-[#6d4fc2]/20 sm:p-5">
          <p className="mb-2 text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-[#10161d]/40">
            the full prompt
          </p>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[0.78rem] leading-relaxed text-[#10161d]/85">
            {data.prompt || "…"}
          </pre>
        </div>

        <button
          onClick={copyPrompt}
          className="nr-pd-cta mt-5 inline-flex items-center gap-2 rounded-full bg-[#8a68e8] px-7 py-3.5 text-[0.82rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "copied — go make it real" : "copy the prompt"}
        </button>

        <p className="mt-4 text-[0.68rem] font-semibold leading-snug text-[#10161d]/45">
          unlocked for this browser — keep this tab or copy it now. questions?{" "}
          <a href="/feed" className="underline underline-offset-4">
            find us in the feed
          </a>
          .
        </p>
      </Shell>
    );
  }

  if (state === "notfound") {
    return (
      <Shell>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ff5470]/12 px-4 py-1.5 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-[#d63d5e]">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
          order not found
        </span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#10161d]">
          this checkout belongs to another browser
        </h2>
        <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-[#10161d]/55">
          the unlock is bound to the browser cookie that started the payment.
          open this page in the original browser, or start a new checkout —
          unpaid sessions are never charged.
        </p>
        <a
          href="/market"
          className="nr-pd-cta mt-5 inline-flex items-center gap-2 rounded-full bg-[#10161d] px-6 py-3 text-[0.78rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04]"
        >
          back to the market
        </a>
      </Shell>
    );
  }

  if (state === "error") {
    return (
      <Shell>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ff5470]/12 px-4 py-1.5 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-[#d63d5e]">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
          status check failed
        </span>
        <p className="mt-4 text-[0.82rem] font-semibold leading-relaxed text-[#10161d]/55">
          {error} — your card was charged only if the payment completed; the
          unlock survives page reloads.
        </p>
        <button
          onClick={() => {
            attempts.current = 0;
            setError(null);
            setState("loading");
            poll();
          }}
          className="nr-pd-cta mt-5 inline-flex items-center gap-2 rounded-full bg-[#10161d] px-6 py-3 text-[0.78rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04]"
        >
          try again
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <span className="inline-flex items-center gap-2 rounded-full bg-[#6d4fc2]/12 px-4 py-1.5 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {state === "loading" ? "checking payment…" : "waiting for confirmation…"}
      </span>
      <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#10161d]">
        unlocking your prompt
      </h2>
      <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-[#10161d]/55">
        keep this tab open — the prompt appears the second the card payment is
        confirmed (usually instantly).
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="nr-pd-shell mx-auto mt-10 max-w-2xl rounded-[2.5rem] border border-[#d9cdf5] bg-gradient-to-br from-[#f6f2fd] via-white to-[#f9f5ff] p-6 text-center shadow-[0_24px_70px_rgba(122,92,224,0.14)] sm:p-10">
      {children}
    </div>
  );
}
