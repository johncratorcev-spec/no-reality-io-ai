import { NextResponse } from "next/server";
import { supabaseConfigured, turnstileConfigured } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/status — какие двери входа открыты (форма /auth рисует
 * поля только под настроенные провайдеры; без ключей — честный
 * «вход подключается», НИКОГДА не 500). v21: email+пароль и magic-код
 * через Supabase; Google выключен и из API не отдаётся.
 */
export async function GET() {
  const supabase = supabaseConfigured();
  return NextResponse.json(
    {
      supabase,
      password: supabase, // email + пароль (основной путь)
      otp: supabase, // magic-код на email через Supabase Auth
      turnstile: turnstileConfigured(),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
