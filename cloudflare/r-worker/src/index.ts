/**
 * Cloudflare Worker — быстрый 302 для /r/:code (task 44, ТЗ §1.3).
 *
 * Поток:
 *   GET /r/<code>
 *     → KV lookup "u:<code>" (доли миллисекунды)
 *     → промах: fetch origin /api/r-lookup/<code> (CSV-кэш, без БД) + KV TTL 1ч
 *     → 302 Location: <threads url>  — ответ уходит НЕМЕДЛЕННО
 *     → ctx.waitUntil: POST origin /api/track/click { code, visitorHash }
 *       (асинхронная запись уникального клика в существующую БД;
 *        visitorHash = sha256(ip :: ua :: CLICK_WORKER_SECRET) — WebCrypto)
 *
 * Неизвестный код / ошибка lookup → прозрачный прокси на origin /r/<code>
 * (там корректные 404/429 и запись клика по классическому пути).
 * Накрутка бессмысленна: дедуп по visitorHash живёт в БД, как и раньше.
 */

export interface Env {
  POST_URLS: KVNamespace;
  ORIGIN: string;
  CLICK_WORKER_SECRET: string;
}

const CODE_RE = /^[A-Za-z0-9_-]{2,32}$/;
const KV_TTL_SEC = 3600;

function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return crypto.subtle
    .digest("SHA-256", data)
    .then((buf) => {
      const arr = new Uint8Array(buf);
      let s = "";
      for (const b of arr) s += b.toString(16).padStart(2, "0");
      return s;
    });
}

async function lookupUrl(env: Env, code: string): Promise<string | null> {
  const kvKey = `u:${code}`;
  try {
    const hit = await env.POST_URLS.get(kvKey);
    if (hit) return hit;
  } catch {
    /* KV недоступен — упадём на origin lookup */
  }
  try {
    const r = await fetch(`${env.ORIGIN}/api/r-lookup/${code}`, {
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { url?: string };
    if (!d.url) return null;
    // KV путём best-effort: упадёт — следующий клик снова спросит origin
    try {
      await env.POST_URLS.put(kvKey, d.url, { expirationTtl: KV_TTL_SEC });
    } catch {
      /* ignore */
    }
    return d.url;
  } catch {
    return null;
  }
}

async function recordClick(env: Env, code: string, req: Request): Promise<void> {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const ua = req.headers.get("user-agent") || "unknown";
    const visitorHash = await sha256Hex(`${ip}::${ua}::${env.CLICK_WORKER_SECRET}`);
    await fetch(`${env.ORIGIN}/api/track/click`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nr-worker-key": env.CLICK_WORKER_SECRET,
      },
      body: JSON.stringify({ code, visitorHash }),
    });
  } catch {
    /* клик не критичен: редирект уже отработал */
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const code = decodeURIComponent(url.pathname.replace(/^\/r\//, "")).trim();

    if (req.method !== "GET" || !CODE_RE.test(code)) {
      // не наш кейс — прозрачный прокси на origin
      return fetch(`${env.ORIGIN}${url.pathname}${url.search}`, req);
    }

    const dest = await lookupUrl(env, code);
    if (!dest) {
      // неизвестный код: origin вернёт 404 (и никаких записей)
      return fetch(`${env.ORIGIN}/r/${code}`, { redirect: "manual" });
    }

    // мгновенный 302 с грани; клик дописываем в фоне
    ctx.waitUntil(recordClick(env, code, req));
    return new Response(null, {
      status: 302,
      headers: {
        location: dest,
        "cache-control": "no-store",
      },
    });
  },
};
