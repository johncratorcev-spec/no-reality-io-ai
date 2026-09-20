import type { Metadata } from "next";
import { getPostsFromCSV } from "@/lib/csv";
import OracleConsole from "./OracleConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "oracle console — no reality.",
  robots: { index: false, follow: false },
};

/**
 * Block 8 спеки: панель оракула /admin/resolution.
 * Сервер отдаёт только статику постов (кадр-стоп в титановой рамке);
 * рынки/вердикты — клиентская консоль через /api/cryo/* + админ-ключ.
 */
export default function AdminResolutionPage() {
  const posts = getPostsFromCSV().map((p) => ({
    code: p.utmCode,
    videoUrl: p.videoUrl,
    title: p.title,
    author: p.author,
  }));
  return <OracleConsole posts={posts} />;
}
