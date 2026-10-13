"use client";

import { useEffect } from "react";
import { initPoolsChannel } from "@/hooks/use-pool-channel";

/**
 * v23 — одноразовый бутстрап Realtime-канала пулов (клиент).
 * RSC передаёт SUPABASE_URL/ANON_KEY (анон-ключ публичен по дизайну —
 * это штатный ключ браузерных клиентов Supabase). Пусто → канал не
 * создаётся, лента живёт на поллинге.
 */
export default function PoolsBoot({ url, k }: { url: string; k: string }) {
  useEffect(() => {
    initPoolsChannel(url, k);
  }, [url, k]);
  return null;
}
