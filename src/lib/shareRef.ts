/**
 * Персональный код в share-ссылках (task 44, ТЗ §5) — CLIENT-ONLY.
 *
 * Источники кода:
 *   1) "nr-my-ref" — СВОЙ код, сохраняется после авторизации
 *      (use-wallet пишет ответ auth-роута сюда);
 *   2) фолбэк — захваченный ?ref= (REFERRAL.storageKey): гость,
 *      делящийся ссылкой, продолжает цепочку пригласившего.
 *
 * myShareRef()/withRef() вызываются ТОЛЬКО в обработчиках кликов
 * (читают localStorage) — SSR/гидратации это не касается.
 */
import { REFERRAL } from "@/lib/site";

const MINE_KEY = "nr-my-ref";
const CODE_RE = /^r[a-z0-9]{5,11}$/;

/** auth-роуты/use-wallet сохраняют СВОЙ код после успешного входа */
export function storeMyRef(code: string | null | undefined): void {
  try {
    if (code && CODE_RE.test(code)) localStorage.setItem(MINE_KEY, code);
  } catch {
    /* приватный режим */
  }
}

/** код для шеринга: свой, иначе захваченный ?ref=, иначе null */
export function myShareRef(): string | null {
  try {
    const mine = localStorage.getItem(MINE_KEY);
    if (mine && CODE_RE.test(mine)) return mine;
    const captured = localStorage.getItem(REFERRAL.storageKey);
    return captured && CODE_RE.test(captured) ? captured : null;
  } catch {
    return null;
  }
}

/** добавить ?ref=<код> к ссылке (ничего не портит, если кода нет) */
export function withRef(url: string): string {
  const ref = myShareRef();
  if (!ref) return url;
  return `${url}${url.includes("?") ? "&" : "?"}ref=${ref}`;
}
