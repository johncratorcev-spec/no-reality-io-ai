import { NextResponse } from "next/server";
import { accessKeyRequired } from "@/lib/auth/password";
import { turnstileConfigured } from "@/lib/auth/turnstile";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/status — какие двери входа открыты (форма /auth рисует
 * поля под настроенный путь; НИКОГДА не 500). v22: вход — чистая логика
 * БД (email + пароль, EmailAuth scrypt), Supabase Auth снят с входа.
 * keyRequired — регистрация закрыта ключом NR_ACCESS_KEY (вход — без ключа).
 */
export async function GET() {
  return NextResponse.json(
    {
      password: true, // email + пароль — единственная дверь, живёт в БД
      keyRequired: accessKeyRequired(),
      turnstile: turnstileConfigured(),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
