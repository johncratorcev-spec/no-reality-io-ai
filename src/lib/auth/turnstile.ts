import "server-only";

/**
 * v22 — Cloudflare Turnstile (антибот, ОПЦИЯ): включён, только если
 * стоят оба ключа. Вынесен из lib/auth/supabase.ts (Supabase Auth
 * полностью снят с входа — теперь пароли живёт в нашей БД), проверка
 * токена осталась прежней: siteverify, fail-closed.
 */

/** Turnstile (антибот, опция): включён, если есть оба ключа */
export function turnstileConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

/** проверка Cloudflare Turnstile токена (siteverify). false = не пройден */
export async function verifyTurnstile(
  token: unknown,
  ip: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET || "";
  if (!secret) return true; // не настроен — выключен
  if (typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      "remoteip": ip,
    });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const d = (await r.json()) as { success?: boolean };
    return Boolean(d.success);
  } catch {
    return false; // сеть упала — считаем капчу не пройденной (fail-closed)
  }
}
