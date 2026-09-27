import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/** GET /api/auth/google/status — UI спрашивает, показывать ли кнопку Google. */
export async function GET() {
  return NextResponse.json({ enabled: googleConfigured() });
}
