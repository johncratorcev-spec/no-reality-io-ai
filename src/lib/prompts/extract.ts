/**
 * Эвристика извлечения промпта из текста поста (заголовка).
 *
 * Текст поста в ленте — это title из CSV; авторы AI-видео часто кладут
 * промпт прямо в описание. Здесь мы делаем «лучшее усилие»: если промпт
 * найдётся — кнопка Copy Prompt активна, если нет — показываем только
 * Open in Threads. Никаких тяжёлых зависимостей, чистые regex.
 *
 * Клиент-безопасный модуль (используется и на клиенте в fallback'е).
 */

const MAX_PROMPT_LEN = 1200;

export function extractPrompt(text: string | undefined | null): string | null {
  if (!text) return null;
  const t = text.replace(/\s+\n/g, "\n").trim();
  if (t.length < 12) return null;

  // 1) явная метка "prompt:" / "prompt |" / "prompt -" (в т.ч. в конце строки)
  const labeled = t.match(
    /(?:^|[\n\r])\s*prompt\s*(?::|\||-|—|–)\s*([\s\S]+)$/i
  );
  if (labeled?.[1]) {
    const v = clean(labeled[1]);
    if (isPlausible(v)) return v;
  }

  // 2) длинная закавыченная фраза — авторы любят брать промпт в кавычки
  const quoted = t.match(/[“"]([^“”"]{40,})[”"]/);
  if (quoted?.[1]) {
    const v = clean(quoted[1]);
    if (isPlausible(v)) return v;
  }

  // 3) «prompt =» / «used prompt» в одну строку (без переноса)
  const inline = t.match(/(?:used\s+)?prompt\s*[:=]\s*([^\n]{40,})/i);
  if (inline?.[1]) {
    const v = clean(inline[1]);
    if (isPlausible(v)) return v;
  }

  return null;
}

function clean(s: string): string {
  // снимаем markdown-мусор и хвостовые хэштеги
  const noTags = s
    .replace(/#[\wа-яА-ЯёЁ]+\s*$/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
  return noTags.length > MAX_PROMPT_LEN
    ? `${noTags.slice(0, MAX_PROMPT_LEN - 1).trimEnd()}…`
    : noTags;
}

function isPlausible(v: string | null | undefined): boolean {
  if (!v) return false;
  // слишком короткое или состоящее из одних хэштегов/эмодзи — не промпт
  const words = v.split(/\s+/).filter((w) => /^[#@]/.test(w) === false);
  return v.length >= 12 && words.length >= 4;
}
