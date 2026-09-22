import { NextResponse } from "next/server";
import { magicLinkEnabled } from "@/lib/magic";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/auth/magic/status — включён ли Magic Link вход.
   UI (WalletButton) дергает лениво при открытии дропдауна: флаг
   зависит от серверных env (RESEND_API_KEY), строить флаг в бандл
   через NEXT_PUBLIC_* не нужно.
   ================================================================ */

export async function GET() {
  return NextResponse.json(
    { enabled: magicLinkEnabled() },
    { headers: { "cache-control": "no-store" } }
  );
}
