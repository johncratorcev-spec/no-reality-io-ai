import "server-only";

/**
 * v23 — Supabase Realtime: пулы раундов в реалтайме ВЕЗДЕ.
 *
 * Сервер публикует обновления раунда (ставка ушла / раунд разрешён) в
 * broadcast-канал `nr:pools` через HTTP API Realtime:
 *
 *   POST {SUPABASE_URL}/realtime/v1/api/broadcast
 *   headers: apikey + Authorization Bearer <anon key>
 *   body: { messages: [{ topic, event, payload }] }
 *
 * HTTP-публикация выбрана вместо websocket-клиента: serverless-инстансам
 * (Vercel) не нужно держать долгоживущее соединение, а broadcast (в отличие
 * от postgres_changes) НЕ требует включения таблиц в публикацию и ничего
 * не раскрывает через RLS — полезная нагрузка собирается ТОЛЬКО из
 * публичных полей RoundView (пулы/счётчик/статус), метка никогда не
 * публикуется до резолва.
 *
 * Клиент подписывается через @supabase/supabase-js (use-pool-channel.ts)
 * тем же anon-ключом (он публичен по дизайну). Ключи отсутствуют →
 * realtime молча выключен, лента живёт на поллинге (BET_POLL_MS).
 */

export const POOLS_TOPIC = "nr:pools";
export const POOLS_EVENT = "round";

/** публичный срез раунда для эфира — ТОЛЬКО безопасные поля */
export interface PoolBroadcast {
  id: string;
  clipCode: string;
  status: string;
  poolRealCents: number;
  poolSynthCents: number;
  poolTotalCents: number;
  bettors?: number;
  /** только при резолве — публичное раскрытие метки */
  resolvedAs?: "real" | "synth" | null;
  closesAt: string;
}

function conf(): { url: string; key: string } | null {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return url && key ? { url, key } : null;
}

/** realtime включён (для клиента — RSC отдаёт url/key, для сервера — эфир) */
export function realtimeConf(): { url: string; key: string } | null {
  return conf();
}

/**
 * Публикация обновления раунда. Fire-and-forget: ошибка эфира никогда
 * не роняет ставку/резолв (поллинг остаётся страхующим каналом).
 */
export function broadcastRound(update: PoolBroadcast): void {
  const c = conf();
  if (!c) return;
  const body = JSON.stringify({
    messages: [
      {
        topic: POOLS_TOPIC,
        event: POOLS_EVENT,
        payload: update,
      },
    ],
  });
  fetch(`${c.url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  }).catch(() => {
    /* эфир не обязателен — поллинг страхует */
  });
}
