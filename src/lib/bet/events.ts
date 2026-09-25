import { db } from "@/lib/db";

/**
 * События аналитики (ТЗ v2 §4.3.10) — best-effort: БД недоступна →
 * событие теряется, UX не ломается (тот же принцип, что PageVisit).
 *
 * Серверные имена: bet_placed / bet_won / bet_lost / ref_converted.
 * Клиентские (через POST /api/track/event): clip_view / share_click /
 * prompt_upsell_click / ref_click.
 */
export type TrackName =
  | "clip_view"
  | "bet_placed"
  | "bet_won"
  | "bet_lost"
  | "ref_click"
  | "ref_converted"
  | "share_click"
  | "prompt_upsell_click";

const NAMES = new Set<string>([
  "clip_view",
  "bet_placed",
  "bet_won",
  "bet_lost",
  "ref_click",
  "ref_converted",
  "share_click",
  "prompt_upsell_click",
]);

export function isValidTrackName(raw: unknown): raw is TrackName {
  return typeof raw === "string" && NAMES.has(raw);
}

export async function trackEvent(
  name: TrackName,
  opts: { clipCode?: string; visitorHash?: string; meta?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await db.trackEvent.create({
      data: {
        name,
        clipCode: (opts.clipCode ?? "").slice(0, 64),
        visitorHash: (opts.visitorHash ?? "").slice(0, 64),
        meta: JSON.stringify(opts.meta ?? {}).slice(0, 2000),
      },
    });
  } catch {
    /* аналитика не критична */
  }
}
