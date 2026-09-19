"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* ================================================================
   TrackVisit — невидимый счётчик посещений (монтируется в layout).

   На каждую смену pathname отправляет POST /api/track через
   navigator.sendBeacon (не блокирует выгрузку страницы, не ждёт
   ответа, не влияет на UX). Отдельный элемент не рендерит.
   ================================================================ */

export default function TrackVisit() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    try {
      const payload = JSON.stringify({
        path: pathname,
        referrer: typeof document !== "undefined" ? document.referrer : "",
      });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/track",
          new Blob([payload], { type: "application/json" })
        );
      } else {
        void fetch("/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* статистика не стоит UX-а */
    }
  }, [pathname]);

  return null;
}
