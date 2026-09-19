"use client";

import { useEffect } from "react";
import { REFERRAL } from "@/lib/site";

/* ================================================================
   Ловец пригласительного кода: любой вход с ?ref=rXXXX… сохраняем
   в localStorage (last-touch, 90 дней). При чекауте код уйдёт на
   сервер и вшьётся в orderId — атрибуция не зависит от сессий.
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
    } catch {
      /* private mode — рефералка просто не сработает */
    }
  }, []);

  return null;
}
