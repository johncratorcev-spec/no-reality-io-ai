import { NextResponse } from "next/server";
import { supabaseConfigured, turnstileConfigured } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/status — какие двери входа открыты (форма /auth рисует
 * кнопки только под настроенные провайдеры; без ключей — честный
 * «вход подключается», НИКОГДА не 500).
 */
export async function GET() {
  const supabase = supabaseConfigured();
  return NextResponse.json(
    {
      supabase,
      otp: supabase, // magic-код на email через Supabase Auth
      google: supabase, // Google через Supabase Auth (PKCE)
      turnstile: turnstileConfigured(),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
