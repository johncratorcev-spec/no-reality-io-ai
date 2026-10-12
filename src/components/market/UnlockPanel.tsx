"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, LockOpen, TriangleAlert } from "lucide-react";
import { track } from "@/lib/bet/trackClient";
import { withRef } from "@/lib/shareRef";

/* ================================================================
   UnlockPanel — /market/thanks?code=<product>

   Поллит /api/prompts/[code]/status (только СВОЙ заказ: cookie
   nr_buyer проверяется на сервере). Полный текст промпта показываем
   исключительно при unlocked. Webhook 2328 подтверждает оплату —
   поллинг остаётся как UX-страховка (обычно статус приходит мгновенно).
   ================================================================ */

interface StatusData {
  unlocked: boolean;
  paid?: boolean;
  prompt?: string | null;
  preview?: string | null;
  title?: string | null;
  priceUsdt?: string | null;
}

const POLL_MS = 2500;
const MAX_ATTEMPTS = 80; // ~3.3 мин, дальше — честная ошибка

export default function UnlockPanel({ code }: { code: string }) {
  const [state, setState] = useState<
    "loading" | "pending" | "unlocked" | "notfound" | "error"
  >(code ? "loading" : "notfound");
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    attempts.current += 1;
    try {
      const r = await fetch(`/api/prompts/${encodeURIComponent(code)}/status`, {
        cache: "no-store",
      });
      const d = (await r.json()) as StatusData & { error?: string };
      if (r.status === 404) {
        setState("notfound");
        return;
      }
      if (!r.ok) throw new Error(d.error || `status ${r.status}`);
      setData(d);
      if (d.unlocked) {
        setState("unlocked");
        return; // стоп поллинга — промпт раскрыт
      }
      setState("pending");
    } catch (e) {
      /* одиночный сетевой сбой терпим — добираем до MAX_ATTEMPTS */
      if (attempts.current >= MAX_ATTEMPTS) {
        setError(e instanceof Error ? e.message : "status failed");
        setState("error");
        return;
      }
    }
    if (attempts.current < MAX_ATTEMPTS) {
      timer.current = setTimeout(poll, POLL_MS);
    } else {
      setState((s) => (s === "unlocked" ? s : "error"));
    }
  }, [code]);

  useEffect(() => {
    void poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  const copyPrompt = async () => {
    if (!data?.prompt) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard запрещён */
    }
  };

  const share = useCallback(async () => {
    const url = withRef(`${window.location.origin}/market?unlock=${encodeURIComponent(code)}`);
    track("share_result", code, { source: "unlock" });
    try {
      if (navigator.share) {
        await navigator.share({
          title: "no reality.",
          text: "я забрал промпт с no reality. — забирай свой:",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* отмена — не беда */
    }
  }, [code]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[rgba(16,13,22,0.72)] p-6 backdrop-blur-md sm:p-10">
      {state === "loading" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-white/70" aria-hidden />
          <p className="text-[0.85rem] font-bold text-white/70">
            ждём подтверждения оплаты…
          </p>
          <p className="max-w-sm text-[0.68rem] font-semibold leading-relaxed text-white/40">
            крипто-инвойс 2328.io подтверждается подписанным webhook&apos;ом —
            обычно это секунды, страница откроется сама
          </p>
        </div>
      )}

      {state === "pending" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#FF5C7A]" aria-hidden />
          <p className="text-[0.95rem] font-extrabold text-white">
            платёж в работе — проверяем каждые 2.5с
          </p>
          <p className="max-w-sm text-[0.72rem] font-semibold leading-relaxed text-white/50">
            не закрывай страницу: как только инвойс подтвердится, промпт
            раскроется здесь же. если закрыл — вернись на{" "}
            <code className="font-mono text-white/70">/market?unlock={code}</code>
          </p>
          <button
            onClick={() => {
              attempts.current = 0;
              setState("loading");
              void poll();
            }}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[0.7rem] font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            проверить снова
          </button>
        </div>
      )}

      {state === "unlocked" && (
        <div>
          <p className="inline-flex items-center gap-2 text-[0.64rem] font-extrabold uppercase tracking-[0.24em] text-[#C8FF00]">
            <LockOpen className="h-3.5 w-3.5" aria-hidden />
            paid &amp; unlocked — {data?.title || code}
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            промпт твой. один взгляд — и он твой навсегда.
          </h2>
          <div className="mt-5 max-h-[46vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-[rgba(10,10,15,0.6)] p-4 font-mono text-[0.72rem] leading-relaxed text-white/90 [scrollbar-width:thin]">
            {data?.prompt}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={copyPrompt}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[0.78rem] font-extrabold text-[#0A0A0F] transition-transform duration-300 hover:scale-[1.04] active:scale-95"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "скопировано — иди делать" : "copy prompt"}
            </button>
            <button
              onClick={() => void share()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-[0.74rem] font-bold text-white/85 transition-colors hover:bg-white/10"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              share
            </button>
            <a
              href="/market"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-[0.74rem] font-bold text-white/60 transition-colors hover:text-white"
            >
              в витрину
            </a>
          </div>
        </div>
      )}

      {state === "notfound" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <TriangleAlert className="h-6 w-6 text-[#FF5C7A]" aria-hidden />
          <p className="text-[0.9rem] font-extrabold text-white">промпт не найден</p>
          <p className="max-w-sm text-[0.72rem] font-semibold text-white/50">
            ссылка повреждена — открой витрину и забери дроп оттуда
          </p>
          <a
            href="/market"
            className="rounded-full bg-white px-5 py-2.5 text-[0.74rem] font-extrabold text-[#0A0A0F]"
          >
            в витрину
          </a>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <TriangleAlert className="h-6 w-6 text-[#FF5C7A]" aria-hidden />
          <p className="text-[0.9rem] font-extrabold text-white">
            {error || "не дождались подтверждения"}
          </p>
          <p className="max-w-sm text-[0.72rem] font-semibold leading-relaxed text-white/50">
            если инвойс был оплачен — промпт не потерян: cookie покупателя
            сохранена, вернись через минуту или открой{" "}
            <code className="font-mono text-white/70">/market?unlock={code}</code>
          </p>
          <button
            onClick={() => {
              attempts.current = 0;
              setError(null);
              setState("loading");
              void poll();
            }}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[0.7rem] font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            проверить снова
          </button>
        </div>
      )}
    </div>
  );
}
