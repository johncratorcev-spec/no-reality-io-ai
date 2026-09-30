import { redirect } from "next/navigation";

/**
 * v11 — /seam: алиас игрового экрана для BD-ссылок (одно касание:
 * «Live product: REAL vs SYNTH, points only. Link: /seam»).
 * Продукт один — /bet; этот адрес просто приводит туда же.
 */
export default function SeamRedirect() {
  redirect("/bet");
}
