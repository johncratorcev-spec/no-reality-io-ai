import { db } from "@/lib/db";

/**
 * События аналитики (ТЗ v2 §4.3.10 + v5 воронка предикшен-ленты) —
 * best-effort: БД недоступна → событие теряется, UX не ломается.
 *
 * Серверные: bet_placed / bet_won / bet_lost / deposit_paid /
 * referral_earn / boost_purchase / ref_converted.
 * Клиентские (POST /api/track/event): prediction_view / clip_view /
 * wallet_connect / share_result / share_click / prompt_upsell_click /
 * referral_click / onboarding_* / predict_modal_open / topup_open /
 * funnel_* (воронка предикшенов v6)
 */
export type TrackName =
  | "clip_view"
  | "prediction_view"
  | "wallet_connect"
  | "bet_placed"
  | "bet_won"
  | "bet_lost"
  | "ref_click"
  | "referral_click"
  | "ref_converted"
  | "referral_earn"
  | "share_click"
  | "share_result"
  | "prompt_upsell_click"
  | "boost_purchase"
  | "deposit_paid"
  | "predict_modal_open"
  | "topup_open"
  | "topup_paid"
  | "funnel_side_pick"
  | "funnel_amount_pick"
  | "funnel_confirm"
  | "funnel_insufficient"
  | "balance_refilled"
  | "welcome_granted"
  | "daily_claimed"
  | "pass_granted"
  | "google_signin"
  | "google_signup"
  | "ig_reward_claimed"
  | "deposit_bonus_paid"
  | "reward_click"
  | "utm_reward"
  | "onboarding_done"
  | "onboarding_skip"
  | "hard_mode_open"
  | "prediction_upsell";

const NAMES = new Set<string>([
  "clip_view",
  "prediction_view",
  "wallet_connect",
  "bet_placed",
  "bet_won",
  "bet_lost",
  "ref_click",
  "referral_click",
  "ref_converted",
  "referral_earn",
  "share_click",
  "share_result",
  "prompt_upsell_click",
  "boost_purchase",
  "deposit_paid",
  "predict_modal_open",
  "topup_open",
  "topup_paid",
  "funnel_side_pick",
  "funnel_amount_pick",
  "funnel_confirm",
  "funnel_insufficient",
  "balance_refilled",
  "welcome_granted",
  "daily_claimed",
  "pass_granted",
  "reward_click",
  "utm_reward",
  "onboarding_done",
  "onboarding_skip",
  "hard_mode_open",
  "prediction_upsell",
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
