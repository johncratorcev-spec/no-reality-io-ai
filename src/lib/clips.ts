import "server-only";

import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import {
  competitionCodeOf as competitionOf,
  competitionNumberOf,
  isHalloweenBadge,
} from "@/lib/competition";

export { competitionOf, competitionNumberOf, isHalloweenBadge };

/**
 * v14 — таблица clips как ЕДИНСТВЕННЫЙ источник контента (CSV удалён).
 *
 * СЕКРЕТНОСТЬ (проверяется selftest'ом):
 *   - video_url / source_url / author_handle / label — ТОЛЬКО сервер;
 *   - клиент играет видео через прокси /api/clip/[id]/video;
 *   - публичный payload раунда/клипа: id, caption_public (после фильтра),
 *     прокси видео, closes_at, пулы, label_commit — БЕЗ метки, автора,
 *     исходной ссылки и прямого video_url;
 *   - подписи с генеративными маркерами (seedance, higgsfield, kling,
 *     runway, veo, ai, prompt, нейро) в раунд не отдаются — фильтр
 *     применяется при вставке И при выдаче (defense in depth).
 */

/* ------------------------------------------------------------------ */
/*  Commit-reveal метки                                                */
/* ------------------------------------------------------------------ */

/**
 * label_commit = sha256(label || ':' || id || ':' || COMMIT_PEPPER).
 * COMMIT_PEPPER — только env (см. ТЗ «Секреты только в env»).
 */
export function labelCommitOf(id: string, label: string): string {
  const pepper = process.env.COMMIT_PEPPER || "";
  return createHash("sha256")
    .update(`${label}:${id}:${pepper}`)
    .digest("hex");
}

/** проверка раскрытого хеша (reveal-карточка: «хеш сошёлся») */
export function labelCommitMatches(id: string, label: string, commit: string): boolean {
  if (!commit) return false;
  const expected = labelCommitOf(id, label);
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(commit, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/*  Фильтр генеративных маркеров в публичных подписях                  */
/* ------------------------------------------------------------------ */

/** однозначные подстроки (регистр не важен) */
const BANNED_SUBSTR = [
  "seedance",
  "higgsfield",
  "kling",
  "runway",
  "prompt",
  "нейро",
  "нейро-",
];
/** короткие маркеры — только как ОТДЕЛЬНОЕ слово (иначе «chair» отвалится) */
const BANNED_WORDS_RE = /(^|[^a-zа-яё])(ai|veo|gen-?ai)([^a-zа-яё]|$)/i;

/** true, если подпись содержит генеративный маркер → в раунд не отдаём */
export function captionHasBannedWords(caption: string): boolean {
  const s = (caption || "").toLowerCase();
  if (!s) return false;
  if (BANNED_SUBSTR.some((w) => s.includes(w))) return true;
  return BANNED_WORDS_RE.test(s);
}

/**
 * Публичная подпись: срезает генеративные маркеры. Если маркер внутри —
 * подпись в раунд не идёт вовсе (правило ТЗ: «подпись с … в раунд не
 * отдавать»), частичные вырезы оставили бы утечку.
 */
export function scrubCaption(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  return captionHasBannedWords(s) ? "" : s.slice(0, 280);
}

/* ------------------------------------------------------------------ */
/*  Типы                                                               */
/* ------------------------------------------------------------------ */

/** полная строка клипа — ТОЛЬКО для серверного кода (никогда не сериализуется) */
export type ClipRow = {
  id: string;
  sourceUrl: string;
  videoUrl: string;
  authorHandle: string;
  captionPublic: string;
  label: string;
  labelCommit: string;
  status: string;
  opensAt: Date | null;
  closesAt: Date | null;
  resolvedAt: Date | null;
  listedBy: string;
  featuredUntil: Date | null;
  badge: string;
  pin: number;
  /** v20 — медиа-типы: video | carousel | audio (+ mediaJson) */
  mediaType: string;
  mediaJson: string;
  createdAt: Date;
  updatedAt: Date;
};

/** клиентский/публичный срез — безопасен для RSC-пейлоада */
export interface PublicClipMedia {
  /** фото-карусель (порядок как в посте), проксированные URL */
  photos: string[];
  /** голосовая (проксированный URL) */
  audioUrl?: string;
}

export interface PublicClip {
  id: string;
  caption: string; // caption_public после фильтра
  videoUrl: string; // ПРОКСИ (/api/clip/<id>/video), не CDN
  /** v26 — "soon": тизер в ленте без раффла (заглушка «скоро предсказания»);
   *  планировщик его не продвигает (берёт только queued) */
  status: "queued" | "soon" | "live" | "resolved" | "void";
  badge: string;
  featured: boolean;
  /** v20 — медиа-тип карточки: video (по умолчанию) | carousel | audio */
  mediaType: "video" | "carousel" | "audio";
  /** v20 — карусель/аудио (проксированные URL; исходники — server-only) */
  media: PublicClipMedia;
  /** v15: соревнование (badge вида "raffle-01") — специальное оформление */
  competition?: string;
  /** resolved: раскрытая метка; иначе отсутствует */
  resolvedAs?: "real" | "synth";
  /** resolved: label_commit для сверки карточки результата */
  labelCommit?: string;
  /** void: раунд отменён (битая ссылка), ставки возвращены */
  voided?: boolean;
}

/**
 * v15 — соревнования: каноническая реализация в @/lib/competition
 * (клиент-безопасный модуль), здесь — реэкспорт для серверных вызовов.
 */

export function clipProxyUrl(id: string): string {
  return `/api/clip/${encodeURIComponent(id)}/video`;
}

/** прокси фото-слайда карусели (исходная ссылка — server-only) */
export function clipMediaProxyUrl(id: string, index: number): string {
  return `/api/clip/${encodeURIComponent(id)}/media?i=${index}`;
}

/** прокси аудиофайла (исходная ссылка — server-only) */
export function clipAudioProxyUrl(id: string): string {
  return `/api/clip/${encodeURIComponent(id)}/audio`;
}

/** mediaJson → публичный срез (photos→прокси по индексу, audio→прокси) */
function publicMediaOf(id: string, mediaType: string, mediaJson: string): PublicClipMedia {
  const out: PublicClipMedia = { photos: [] };
  try {
    const raw = JSON.parse(mediaJson || "{}") as { photos?: unknown[]; audioUrl?: unknown };
    if (Array.isArray(raw.photos)) {
      out.photos = raw.photos
        .filter((u): u is string => typeof u === "string" && u.length > 0)
        .slice(0, 10)
        .map((_, i) => clipMediaProxyUrl(id, i));
    }
    if (typeof raw.audioUrl === "string" && raw.audioUrl) {
      out.audioUrl = clipAudioProxyUrl(id);
    }
  } catch {
    /* битый JSON — пустой срез */
  }
  if (mediaType !== "carousel") out.photos = [];
  if (mediaType !== "audio") out.audioUrl = undefined;
  return out;
}

/** публичный срез строки БД (метка/автор/исходник/CDN остаются на сервере) */
export function toPublicClip(c: {
  id: string;
  captionPublic: string;
  status: string;
  label: string;
  labelCommit: string;
  badge: string;
  featuredUntil: Date | null;
  mediaType?: string;
  mediaJson?: string;
}): PublicClip {
  const status = (c.status || "queued") as PublicClip["status"];
  const mediaType =
    c.mediaType === "carousel" || c.mediaType === "audio" ? c.mediaType : "video";
  const out: PublicClip = {
    id: c.id,
    caption: scrubCaption(c.captionPublic),
    videoUrl: clipProxyUrl(c.id),
    status,
    badge: (c.badge || "").trim(),
    featured: c.featuredUntil ? c.featuredUntil.getTime() > Date.now() : false,
    mediaType,
    media: publicMediaOf(c.id, mediaType, c.mediaJson ?? ""),
  };
  const competition = competitionOf(out.badge);
  if (competition) out.competition = competition;
  if (status === "resolved") {
    out.resolvedAs = c.label === "real" ? "real" : "synth";
    out.labelCommit = c.labelCommit;
  }
  if (status === "void") out.voided = true;
  return out;
}

/* ------------------------------------------------------------------ */
/*  Доступ к БД                                                        */
/* ------------------------------------------------------------------ */

export function clipById(id: string): Promise<ClipRow | null> {
  return db.clip
    .findUnique({ where: { id } })
    .then((c) => (c ? (c as unknown as ClipRow) : null));
}

/** truth клипа для движка ставок (server-only). Нет метки — клип не bets. */
export async function truthOf(id: string): Promise<"real" | "synth" | undefined> {
  const c = await db.clip.findUnique({
    where: { id },
    select: { label: true, status: true },
  });
  if (!c) return undefined;
  if (c.status === "void") return undefined;
  return c.label === "real" ? "real" : c.label === "synth" ? "synth" : undefined;
}

/**
 * Лента: пины по возрастанию → featured (свежее вперёд) → score → новые.
 * Метка в SQL-срез не попадает (select без label).
 */
export async function feedClips(limit = 60): Promise<Array<PublicClip & { score: number }>> {
  const rows = await db.clip.findMany({
    where: { status: { not: "void" } },
    select: {
      id: true,
      captionPublic: true,
      status: true,
      label: true,
      labelCommit: true,
      badge: true,
      featuredUntil: true,
      pin: true,
      mediaType: true,
      mediaJson: true,
      createdAt: true,
    },
    take: 300,
    orderBy: { createdAt: "desc" },
  });

  let scores = new Map<string, number>();
  try {
    const stats = await db.postStats.findMany({
      where: { utmCode: { in: rows.map((r) => r.id) } },
      select: { utmCode: true, score: true },
    });
    scores = new Map(stats.map((s) => [s.utmCode, s.score]));
  } catch {
    /* лента живёт и без счётчика */
  }

  const now = Date.now();
  const mapped = rows.map((r) => ({
    ...toPublicClip(r),
    pin: r.pin,
    featuredUntilMs: r.featuredUntil ? r.featuredUntil.getTime() : 0,
    score: scores.get(r.id) ?? 0,
    createdAtMs: r.createdAt.getTime(),
  }));

  return mapped
    .sort((a, b) => {
      const pa = a.pin || 0;
      const pb = b.pin || 0;
      if (pa || pb) {
        if (pa && pb) return pa - pb;
        return pa ? -1 : 1;
      }
      const fa = a.featuredUntilMs > now ? 1 : 0;
      const fb = b.featuredUntilMs > now ? 1 : 0;
      if (fa !== fb) return fb - fa;
      if (fa && fb) return b.featuredUntilMs - a.featuredUntilMs;
      return b.score - a.score || b.createdAtMs - a.createdAtMs;
    })
    .slice(0, limit)
    .map(({ pin: _pin, featuredUntilMs: _f, score, ...rest }) => ({ ...rest, score }));
}

/** сколько клипов в очереди (для панели и empty-state игры) */
export async function queuedClipCount(): Promise<number> {
  return db.clip.count({ where: { status: "queued" } });
}
