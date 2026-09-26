/** Детерминированная ротация карточки по коду (SSR-стабильная) */
export function hashRot(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  const r = (Math.abs(h) % 26) / 10 - 1.3; // −1.3° … +1.2°
  return `${r.toFixed(1)}deg`;
}
