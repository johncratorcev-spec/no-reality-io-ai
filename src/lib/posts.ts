import { feedClips, type PublicClip } from "@/lib/clips";

export type ClientRankedPost = {
  /** публичный id клипа (= utm_code для мигрированных строк) */
  utmCode: string;
  title: string;
  /** v14: автор публично НЕ отдаётся (слепой формат, author_handle — server-only) */
  author: string;
  /** ПРОКСИ (/api/clip/<id>/video) — CDN-ссылка с сервера не уходит */
  videoUrl: string;
  score: number;
  featured?: boolean;
  badge?: string;
  status: "queued" | "live" | "resolved" | "void";
  /** только у resolved: раскрытая метка для витрины */
  resolvedAs?: "real" | "synth";
  bettable: boolean;
};

/**
 * v14 — лента из таблицы clips (CSV удалён из дерева).
 * truth/label в клиентский срез не попадает никогда; bettable не
 * раскрывает, КАКАЯ метка. Автор и исходная ссылка — server-only.
 */
export async function getRankedPosts(): Promise<ClientRankedPost[]> {
  const clips = await feedClips(60).catch(() => [] as Array<PublicClip & { score: number }>);
  return clips.map((c) => ({
    utmCode: c.id,
    title: c.caption,
    author: "",
    videoUrl: c.videoUrl,
    score: c.score,
    featured: c.featured || undefined,
    badge: c.badge || undefined,
    status: c.status,
    resolvedAs: c.resolvedAs,
    bettable: c.status === "live",
  }));
}

/** совместимость со старыми вызовами (v13): тождественно клиентскому срезу */
export function toClientRankedPosts(posts: ClientRankedPost[]): ClientRankedPost[] {
  return posts;
}
