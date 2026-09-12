import { createHmac, timingSafeEqual } from "crypto";

/**
 * Подпись запросов 2328.io — по официальной документации (doc.2328.io):
 *
 *   sign = HMAC-SHA256( base64( COMPACT_JSON(body) ), apiKey ) → lowercase hex
 *
 * Нюансы, от которых зависит совпадение подписи:
 * - JSON компактный, без пробелов (JSON.stringify так и делает);
 * - JS не эскейпит не-ASCII и не эскейпит "/" — это эквивалент
 *   JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES из примеров документации;
 * - пустое тело (GET) = HMAC от пустой строки: base64("") === "".
 */
export function sign2328Body(body: unknown, apiKey: string): string {
  const json = body === undefined || body === null ? "" : JSON.stringify(body);
  const base64 = Buffer.from(json, "utf-8").toString("base64");
  return createHmac("sha256", apiKey).update(base64, "utf-8").digest("hex");
}

/**
 * Верификация входящего webhook'а: тот же алгоритм в обратную сторону.
 * 1) вынимаем sign из payload; 2) кодируем остальное как компактный JSON;
 * 3) base64; 4) HMAC-SHA256 нужным ключом; 5) сравнение за константное время.
 *
 * Порядок ключей важен: JSON.parse сохраняет порядок вставки исходного JSON,
 * поэтому повторная сериализация распарсенного объекта даёт те же байты.
 */
export function verify2328Sign(
  payload: Record<string, unknown>,
  receivedSign: string,
  apiKey: string
): boolean {
  if (!receivedSign) return false;
  const { sign: _omit, ...rest } = payload;
  const expected = sign2328Body(rest, apiKey);

  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(receivedSign, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
