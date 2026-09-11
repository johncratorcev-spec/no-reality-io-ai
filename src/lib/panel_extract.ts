/* Serverless-помощники панели: нормализация ввода, метаданные поста через
   r.jina.ai (заголовок/автор; видео Threads в статику не отдаёт — поэтому
   адрес видео пользователь вставляет сам) и проверка CDN-ссылки. */

const CODE_RE = /^[A-Za-z0-9_-]{5,}$/;

export function parsePostInput(raw: string): { code: string; url: string } | null {
  const s = (raw || "").trim();
  if (!s.includes("/") && CODE_RE.test(s)) {
    return { code: s, url: `https://www.threads.com/share/${s}/` };
  }
  let u: URL;
  try {
    u = new URL(s.includes("://") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const segs = u.pathname.split("/").filter(Boolean);
  const code = segs[segs.length - 1] ?? "";
  if (!CODE_RE.test(code)) return null;
  if (u.pathname.includes("/post/")) {
    return { code, url: `https://www.threads.com${u.pathname}` };
  }
  return { code, url: `https://www.threads.com/share/${code}/` };
}

export interface JinaMeta {
  title: string;
  author: string | null;
  walled: boolean;
}

/** Метаданные поста через r.jina.ai (рендерит страницу на своей стороне). */
export async function jinaMeta(postUrl: string): Promise<JinaMeta | null> {
  try {
    const r = await fetch(`https://r.jina.ai/${postUrl}`, {
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const t = await r.text();
    if (/Join Threads/.test(t)) return { title: "", author: null, walled: true };

    let author: string | null = null;
    const tm = t.match(/^Title:\s*(.+)$/m);
    if (tm) {
      const am = tm[1].match(/@([A-Za-z0-9_.]+)/);
      if (am) author = `@${am[1].replace(/\.$/, "")}`;
    }
    const content = t.split("Markdown Content:")[1] ?? "";
    const body = content
      .split("\n")
      .filter((l) => !/^\s*\[!\[/.test(l)) // шапка с аватаркой
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return { title: body.slice(0, 220), author, walled: false };
  } catch {
    return null;
  }
}

/** Threads-CDN жив? Range-запрос → 206 + video/*. */
export async function verifyVideoUrl(u: string): Promise<boolean> {
  try {
    const r = await fetch(u, {
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    const ct = r.headers.get("content-type") || "";
    return r.status === 206 && ct.includes("video");
  } catch {
    return false;
  }
}
