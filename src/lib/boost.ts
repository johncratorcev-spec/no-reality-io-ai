/**
 * Буст поста: активен, пока boostUntil (unix ms) в будущем.
 * Чистый модуль — используется и на сервере (ранжирование),
 * и на клиенте (кнопка автора), без node-зависимостей.
 */
export function isBoosted(p: { boostUntil?: number }, now = Date.now()): boolean {
  return (p.boostUntil ?? 0) > now;
}
