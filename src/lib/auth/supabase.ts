import "server-only";

/**
 * v21 — Supabase Auth (GoTrue) как ЕДИНСТВЕННАЯ дверь входа:
 *   1. Email + пароль (ОСНОВНОЙ путь):
 *      вход  — POST /auth/v1/token?grant_type=password;
 *      регистр — POST /auth/v1/signup (новый аккаунт → сразу +100 EYE
 *      через signInWithEmailIdentity/ensureAccount); если в проекте
 *      включено подтверждение email и сессия не вернулась —
 *      дожидаемся 6-значного кода (otpSend → otpVerify).
 *   2. Magic-код (запасной путь, тем же письмом): POST /auth/v1/otp →
 *      POST /auth/v1/verify {type:"email"} → сессия → наш cookie.
 *   Google-провайдер ВЫКЛЮЧЕН (v21): PKCE-флоу и роуты удалены.
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

/* ---------------- Email + пароль (GoTrue) ---------------- */

async function gotrueJson(
  path: string,
  body: unknown
): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(`${supabaseUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

/** код ошибки GoTrue: invalid_credentials | user_already_exists | weak_password… */
function gotrueErrorCode(json: Record<string, unknown>): string {
  return String(json.error_code ?? json.error ?? "").toLowerCase();
}

function profileFromUser(json: Record<string, unknown>): AuthProfile | null {
  const access = typeof json.access_token === "string" ? json.access_token : "";
  return access ? profileFromSession(access) : null;
}

/** Вход существующего пользователя по email+пароль. */
export async function passwordSignIn(
  email: string,
  password: string
): Promise<AuthProfile> {
  if (!supabaseConfigured()) {
    throw new SupabaseAuthError("auth not configured", 503, "auth_unavailable");
  }
  const { status, json } = await gotrueJson("/auth/v1/token?grant_type=password", {
    email,
    password,
  });
  if (status !== 200) {
    /* 400 invalid_credentials = и неверный пароль, и нет такого email
       (без раскрытия существования аккаунта) */
    if (status === 400) {
      throw new SupabaseAuthError("invalid credentials", 400, "invalid_credentials");
    }
    throw new SupabaseAuthError("password grant failed", 502, "auth_unavailable");
  }
  const profile = profileFromUser(json);
  if (!profile) {
    throw new SupabaseAuthError("profile unreadable", 502, "auth_profile");
  }
  return profile;
}

/** Регистрация email+пароль. null = сессии нет (включено подтверждение
    email — дальше 6-значный код через otpSend/otpVerify). */
export async function passwordSignUp(
  email: string,
  password: string
): Promise<AuthProfile | null> {
  if (!supabaseConfigured()) {
    throw new SupabaseAuthError("auth not configured", 503, "auth_unavailable");
  }
  const { status, json } = await gotrueJson("/auth/v1/signup", { email, password });
  if (status !== 200) {
    const code = gotrueErrorCode(json);
    /* user_already_exists → снаружи выглядит как неверный пароль
       (не раскрываем, что аккаунт есть) */
    if (code.includes("already")) {
      throw new SupabaseAuthError("user exists", 401, "invalid_credentials");
    }
    if (code.includes("weak")) {
      throw new SupabaseAuthError("weak password", 400, "weak_password");
    }
    throw new SupabaseAuthError("signup failed", 502, "auth_unavailable");
  }
  return profileFromUser(json);
}
