import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Детерминированный «счётчик просмотров» карточки: хеш utm-кода
 * -> стабильное число в диапазоне 300–5599. Одинаково на сервере
 * и клиенте (без рассинхрона гидратации), не меняется между рендерами.
 */
export function pseudoViews(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) {
    h = (h * 31 + code.charCodeAt(i)) >>> 0;
  }
  return 300 + (h % 5301);
}
