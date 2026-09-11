import { spawn } from "node:child_process";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPostsFromCSV } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Панель добавления постов: секретность = длина пути (без авторизации).
   POST — запустить асинхронную джобу добавления (python3 scripts/panel_add.py,
   прогресс в scripts/panel_jobs/<id>.json); GET ?job= — статус джобы,
   GET без параметров — последние добавления + размер ленты. */

const JOBS_DIR = () => path.join(process.cwd(), "scripts", "panel_jobs");
const PY = () => path.join(process.cwd(), "scripts", "panel_add.py");

const BADGES = new Set([
  "",
  "SWAG",
  "WELCOME TO THE FUTURE",
  "CREEPY",
  "ROCKET SCIENCE",
]);

function codeFromUrl(url: string): string {
  const m = url.trim().match(/([A-Za-z0-9_-]{5,})\/?\s*$/);
  return m ? m[1] : "";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    url?: string;
    badge?: string;
    title?: string;
  } | null;

  const url = (body?.url ?? "").trim();
  const badge = typeof body?.badge === "string" ? body.badge : "";
  const title = (body?.title ?? "").trim();

  if (!url || url.length > 2000) {
    return NextResponse.json({ error: "пустая или слишком длинная ссылка" }, { status: 400 });
  }
  if (!BADGES.has(badge)) {
    return NextResponse.json({ error: "неизвестный бейдж" }, { status: 400 });
  }
  if (title.length > 500) {
    return NextResponse.json({ error: "заголовок длиннее 500 символов" }, { status: 400 });
  }
  const code = codeFromUrl(url);
  if (!code) {
    return NextResponse.json({ error: "не вижу кода поста в ссылке" }, { status: 400 });
  }

  const jobId =
    code.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) +
    "-" +
    Date.now().toString(36);

  try {
    await mkdir(JOBS_DIR(), { recursive: true });
    const logPath = path.join(JOBS_DIR(), `${jobId}.log`);
    const fh = await open(logPath, "a");
    const child = spawn(
      "python3",
      [PY(), "--url", url, "--badge", badge, "--title", title, "--job", jobId],
      { cwd: process.cwd(), detached: true, stdio: ["ignore", fh.fd, fh.fd] },
    );
    child.unref();
    await fh.close();
    if (typeof child.pid !== "number") {
      throw new Error("spawn failed");
    }
  } catch (e) {
    return NextResponse.json(
      { error: "не удалось запустить джобу: " + (e instanceof Error ? e.message : "?") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, jobId });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const job = searchParams.get("job");

  if (job) {
    if (!/^[a-z0-9_-]{1,120}$/.test(job)) {
      return NextResponse.json({ error: "кривой job id" }, { status: 400 });
    }
    try {
      const raw = await readFile(path.join(JOBS_DIR(), `${job}.json`), "utf-8");
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json({ error: "джоба не найдена" }, { status: 404 });
    }
  }

  /* список последних добавлений (CSV хранит порядок добавления) */
  const posts = getPostsFromCSV();
  const items = posts.slice(-8).reverse().map((p) => {
    const m = p.url.match(/\/share\/([A-Za-z0-9_-]+)/);
    return {
      code: m ? m[1] : "",
      author: p.author,
      badge: p.badge ?? "",
      utm: p.utmCode,
    };
  });
  return NextResponse.json({ total: posts.length, items });
}
