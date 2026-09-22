"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* ================================================================
   TrackVisit — невидимый счётчик посещений (монтируется в layout).

   1) На каждую смену pathname отправляет POST /api/track через
      navigator.sendBeacon — pageviews, fire-and-forget.
   2) Task 44 (§5): если в URL сидит ?ref=rXXX — дополнительно биконит
      POST /api/track/ref { ref, targetType, targetId }: переход по
      ПЕРСОНАЛЬНОЙ ссылке засчитывается владельцу кода на конкретный
      объект (video / market / banner / prompt / page). Дедуп живёт
      в БД по unique(owner, target, visitorHash) — спамить бесполезно.
   ================================================================ */

/** pathname → (targetType, targetId) для атрибуции объекта перехода */
function targetOf(pathname: string): { targetType: string; targetId: string } {
  const v = /^\/v\/([\w-]{2,32})/.exec(pathname);
  if (v) return { targetType: "video", targetId: v[1] };
  if (pathname === "/" || pathname.startsWith("/?")) {
    return { targetType: "banner", targetId: "" };
  }
  if (pathname.startsWith("/market")) return { targetType: "prompt", targetId: "" };
  if (pathname.startsWith("/predict")) return { targetType: "market", targetId: "" };
  return { targetType: "page", targetId: "" };
}

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

      /* --- персональные UTM-переходы (task 44, §5) --- */
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^r[a-z0-9]{5,11}$/.test(ref.trim().toLowerCase())) {
        const { targetType, targetId } = targetOf(pathname);
        const refPayload = JSON.stringify({
          ref: ref.trim().toLowerCase(),
          targetType,
          targetId,
        });
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/track/ref",
            new Blob([refPayload], { type: "application/json" })
          );
        } else {
          void fetch("/api/track/ref", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: refPayload,
            keepalive: true,
          }).catch(() => {});
        }
      }
    } catch {
      /* статистика не стоит UX-а */
    }
  }, [pathname]);

  return null;
}
