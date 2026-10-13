"use client";

import { useEffect, useRef } from "react";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * v23 — клиент Supabase Realtime: пулы раффлов обновляются БЕЗ поллинга.
 *
 * Сервер публикует события "round" в канал "nr:pools" (lib/realtime.ts);
 * здесь — один браузерный клиент на вкладку и микро-шина по roundId.
 * BetPanel подписывается на свой раунд: пришёл эфир → пулы/счётчик глаз
 * обновляются в ту же секунду, оптимистичная ставка гасится серверной
 * правдой. Соединения нет (нет ключей/сеть) → лента живёт на поллинге.
 */

export interface PoolUpdate {
  id: string;
  clipCode: string;
  status: string;
  poolRealCents: number;
  poolSynthCents: number;
  poolTotalCents: number;
  bettors?: number;
  resolvedAs?: "real" | "synth" | null;
  closesAt: string;
}

type Listener = (u: PoolUpdate) => void;

const listeners = new Map<string, Set<Listener>>();
const lastUpdate = new Map<string, PoolUpdate>();
let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;

/** подключить канал (идемпотентно; вызывается один раз с ленты) */
export function initPoolsChannel(url: string, key: string): void {
  if (client || !url || !key) return;
  try {
    client = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    channel = client.channel("nr:pools", {
      config: { broadcast: { self: false, ack: false } },
    });
    channel.on("broadcast", { event: "round" }, ({ payload }) => {
      const u = payload as PoolUpdate;
      if (!u || typeof u.id !== "string") return;
      lastUpdate.set(u.id, u);
      const subs = listeners.get(u.id);
      if (subs) for (const fn of subs) fn(u);
    });
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      /* после реконнекта отдаём подписчикам последнее известное состояние */
      for (const [roundId, subs] of listeners) {
        const u = lastUpdate.get(roundId);
        if (u) for (const fn of subs) fn(u);
      }
    });
  } catch {
    client = null;
    channel = null;
  }
}

/** жив ли канал (для отказа от поллинга в UI) */
export function poolsChannelLive(): boolean {
  return channel?.state === "joined";
}

/**
 * подписка на обновления конкретного раунда. onUpdate — стабильный
 * колбэк (useCallback у вызывающего); при переподключении канала
 * последнее состояние доставляется повторно.
 */
export function usePoolUpdate(
  roundId: string | null | undefined,
  onUpdate: (u: PoolUpdate) => void
): void {
  const fnRef = useRef(onUpdate);
  useEffect(() => {
    fnRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!roundId) return;
    const fn = (u: PoolUpdate) => fnRef.current(u);
    const set = listeners.get(roundId) ?? new Set<Listener>();
    set.add(fn);
    listeners.set(roundId, set);
    const last = lastUpdate.get(roundId);
    if (last) fnRef.current(last);
    return () => {
      set.delete(fn);
      if (set.size === 0) {
        listeners.delete(roundId);
        /* RaM: держим lastUpdate — дешёвый кэш на переподключение */
      }
    };
  }, [roundId]);
}
