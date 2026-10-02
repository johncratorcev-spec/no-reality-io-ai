"use client";

import { useEffect } from "react";
import { REFERRAL } from "@/lib/site";
import { track } from "@/lib/bet/trackClient";

/* ================================================================
   Ловец пригласительного кода: любой вход с ?ref=rXXXX… сохраняем
   в localStorage (last-touch, 90 дней) И в cookie nr_ref — cookie
   читает сервер при регистрации (password / telegram / google),
   поэтому атрибуция не зависит от того, что умеет клиент.
   v14: ссылка формата https://no-reality.fun/?ref=код (ТЗ §Рефка).
   ================================================================ */

const CODE_RE = /^r[a-z0-9]{5,11}$/;

export default function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (!ref) return;
      const code = ref.trim().toLowerCase();
      if (!CODE_RE.test(code)) return;
      const saved = localStorage.getItem(REFERRAL.storageKey);
      if (saved === code) return;
      localStorage.setItem(REFERRAL.storageKey, code);
      localStorage.setItem(
        `${REFERRAL.storageKey}-at`,
        String(Date.now())
      );
      /* cookie для серверной атрибуции при регистрации (90 дней,
         last-touch: каждый новый ?ref= перезаписывает) */
      document.cookie = `nr_ref=${encodeURIComponent(code)}; max-age=${90 * 24 * 3600}; path=/; samesite=lax`;
      track("referral_click", undefined, { ref: code });
    } catch {
      /* private mode — рефералка просто не сработает */
    }
  }, []);

  return null;
}
