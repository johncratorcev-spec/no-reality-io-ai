/**
 * Pari-mutuel odds helper (task 43, client-safe — no db imports).
 *
 * Payout multiplier shown BEFORE a bet: if a stake of `amount` lands in the
 * side pool X, the per-unit return is
 *   oddsX = (totalPool + amount) × (1 − fee) / (poolX + amount)
 * Recomputed live as the pool grows — the market panel renders it for the
 * currently selected stake so "win ≈" always matches what the user pays.
 */
export function cryoOdds(
  totalPool: number,
  sidePool: number,
  amount: number,
  feePct: number
): number {
  if (!(amount > 0)) amount = 1;
  const payout = ((totalPool + amount) * (1 - feePct)) / (sidePool + amount);
  return Math.round(payout * 100) / 100;
}

/** Round a decimal string to 2 places and keep it a clean string ("2.5" → "2.50"). */
export function normalizeUsdc(raw: string): string | null {
  const t = raw.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}
