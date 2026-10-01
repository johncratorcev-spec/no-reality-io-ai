"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

/**
 * v13 — единая форма разблокировки BD-панели (POST /api/admin/session).
 * Секрет вводится один раз; дальше живёт httpOnly HMAC-cookie (2ч).
 * Используется: /admin/bd, /admin/bd-guide, секретный путь панели.
 */
export default function AdminGate({ hint }: { hint?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (r.ok) {
        router.refresh();
        return;
      }
      setErr(
        r.status === 429
          ? "too many attempts — wait a bit"
          : "wrong secret"
      );
    } catch {
      setErr("network blinked — try again");
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <p className="flex items-center gap-2 text-[0.6rem] font-black uppercase tracking-[0.3em] text-white/40">
          <Lock className="h-3.5 w-3.5" aria-hidden /> bd console
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
          enter the secret
        </h1>
        {hint && <p className="mt-2 text-[0.72rem] font-semibold text-white/45">{hint}</p>}
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="ADMIN_SECRET"
          autoComplete="off"
          className="mt-5 w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-[#c8ff00]/60"
        />
        {err && <p className="mt-2 text-[0.72rem] font-bold text-[#ff003c]">{err}</p>}
        <button
          onClick={() => void submit()}
          disabled={busy || !code.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#c8ff00] px-5 py-3 text-[0.85rem] font-black text-[#0B0910] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          unlock
        </button>
        <p className="mt-4 text-[0.6rem] font-semibold leading-relaxed text-white/30">
          session lives 2 hours · rate-limited · timing-safe · logged
        </p>
      </div>
    </div>
  );
}
