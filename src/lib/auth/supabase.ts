import "server-only";

import { createHash, randomBytes } from "crypto";

/**
 * v20 — Supabase Auth (GoTrue) как ЕДИНСТВЕННАЯ дверь входа (ТЗ §Стек/§Auth):
 *   1. Magic link / email-OTP: POST /auth/v1/otp → письмо от Supabase
 *      (free tier: 3–4 письма/час, достаточно для онбординга) →
 *      POST /auth/v1/verify {type:"email"} → сессия → наш подписанный cookie.
 *   2. Google: /auth/v1/authorize?provider=google (PKCE: code_verifier в
 *      httpOnly-cookie, challenge в URL) → callback ?code →
 *      POST /auth/v1/token?grant_type=pkce → сессия → наш cookie.
 *
 * ЗАЩИТОСТОЙКОСТЬ (ТЗ §Auth): Supabase не настроен / недоступен →
 * { configured:false } / 503 {auth_unavailable} — НИКОГДА не 500-падение:
 * сайт остаётся смотрибельным, форма входа честно говорит «вход временно
 * закрыт». Старые сессии (nr_uid+nr_auth) живут независимо от Supabase.
 *
 * РЕАЛИЗАЦИЯ — чистый fetch к GoTrue REST (без supabase-js: минус ~40kb
 * в лямбду и ноль зависимостей). Anon key ПУБЛИЧЕН по определению —
 * он не даёт читать данные (RLS), только авторизоваться.
 * SUPABASE_SERVICE_ROLE_KEY сюда НЕ входит (только админ-скрипты).
 */

export const SB_VERIFIER_COOKIE = "nr_sb_cv";
export const SB_NEXT_COOKIE = "nr_sb_next";
export const SB_OTP_COOKIE = "nr_sb_otp"; // sha256(email) — защита verify от подмены

export function supabaseUrl(): string {
  return (process.env.SUPABASE_URL || "").replace(/\/$/, "");
}

export function supabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || "";
}

/** дверь настроена? (иначе форма показывает «вход подключается») */
export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

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

/* ------------------------------------------------------------------ */
/*  Профиль                                                            */
/* ------------------------------------------------------------------ */

export interface AuthProfile {
  email: string;
  emailVerified: boolean;
  name?: string;
}

/** payload JWT Supabase-сессии (без проверки подписи — мы сами его
    получили напрямую от GoTrue по TLS, подпись проверять нечем/не нужно) */
function decodeSessionJwt(
  accessToken: string
): { email?: string; email_verified?: boolean; user_metadata?: Record<string, unknown> } | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function profileFromSession(access: string): AuthProfile | null {
  const p = decodeSessionJwt(access);
  const email = (p?.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) return null;
  const meta = p?.user_metadata ?? {};
  const name =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : undefined;
  /* OTP/PKCE-сессия выдаётся только подтверждённой идентичности */
  return { email, emailVerified: p?.email_verified !== false, name };
}

/* ------------------------------------------------------------------ */
/*  GoTrue REST                                                        */
/* ------------------------------------------------------------------ */

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: supabaseAnonKey(),
    "content-type": "application/json",
    ...extra,
  };
}

export class SupabaseAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

/** Магическое письмо / OTP-код на email (create_user: true — вход=регистрация) */
export async function otpSend(email: string): Promise<void> {
  if (!supabaseConfigured()) {
    throw new SupabaseAuthError("auth not configured", 503, "auth_unavailable");
  }
  const r = await fetch(`${supabaseUrl()}/auth/v1/otp`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, create_user: true }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    /* 429 Supabase = исчерпан почтовый лимит free-tier */
    throw new SupabaseAuthError(
      text.slice(0, 200) || "otp send failed",
      r.status === 429 ? 429 : 502,
      r.status === 429 ? "otp_rate_limited" : "otp_send_failed"
    );
  }
}

/** Обмен email + 6-значного кода на профиль */
export async function otpVerify(email: string, token: string): Promise<AuthProfile> {
  if (!supabaseConfigured()) {
    throw new SupabaseAuthError("auth not configured", 503, "auth_unavailable");
  }
  const r = await fetch(`${supabaseUrl()}/auth/v1/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: "email", email, token: token.trim() }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) {
    throw new SupabaseAuthError(
      "otp verify failed",
      r.status === 400 ? 400 : 502,
      r.status === 400 ? "bad_code" : "otp_verify_failed"
    );
  }
  const d = (await r.json()) as { access_token?: string };
  if (!d.access_token) {
    throw new SupabaseAuthError("no session", 502, "otp_verify_failed");
  }
  const profile = profileFromSession(d.access_token);
  if (!profile) {
    throw new SupabaseAuthError("profile unreadable", 502, "auth_profile");
  }
  return profile;
}

/* ---------------- PKCE (Google через Supabase) ---------------- */

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url"); // 64 символа
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** URL consent-экрана Google через Supabase (PKCE S256) */
export function googleAuthorizeUrl(redirectTo: string): {
  url: string;
  verifier: string;
} {
  const { verifier, challenge } = pkcePair();
  const u = new URL(`${supabaseUrl()}/auth/v1/authorize`);
  u.searchParams.set("provider", "google");
  u.searchParams.set("redirect_to", redirectTo);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "s256");
  return { url: u.toString(), verifier };
}

/** обмен auth-кода на профиль (PKCE) */
export async function googleExchangeCode(
  code: string,
  verifier: string
): Promise<AuthProfile> {
  const r = await fetch(
    `${supabaseUrl()}/auth/v1/token?grant_type=pkce`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }
  );
  if (!r.ok) {
    throw new SupabaseAuthError(
      "code exchange failed",
      502,
      "google_exchange_failed"
    );
  }
  const d = (await r.json()) as { access_token?: string };
  if (!d.access_token) {
    throw new SupabaseAuthError("no session", 502, "google_exchange_failed");
  }
  const profile = profileFromSession(d.access_token);
  if (!profile) {
    throw new SupabaseAuthError("profile unreadable", 502, "auth_profile");
  }
  return profile;
}
