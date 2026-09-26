/**
 * Клиентский трекинг аналитики (ТЗ v2 §4.3.10) — best-effort, не ждём
 * ответа. Отдельный модуль, чтобы BetPanel/ShareSeam не зацикливались.
 */
export function track(name: string, clip?: string, meta?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ name, clip, meta });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track/event", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* аналитика не критична */
  }
}
