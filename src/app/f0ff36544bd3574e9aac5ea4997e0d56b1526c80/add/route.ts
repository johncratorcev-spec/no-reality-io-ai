import { spawn } from "node:child_process";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { customAlphabet } from "nanoid";
import { getPostsFromCSV } from "@/lib/csv";
import { commitFile, getCsvFromGitHub, ghEnabled } from "@/lib/panel_github";
import {
  jinaMeta,
  parsePostInput,
  verifyVideoUrl,
} from "@/lib/panel_extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Панель добавления постов: секретность = длина пути (без авторизации).

   Два режима:
   — Песочница/preview (долгоживущий Node): POST спавнит асинхронную джобу
     scripts/panel_add.py (извлечение через agent-browser, кэш, CSV+снапшот
     на диске), клиент поллит GET ?job=.
   — Serverless (VERCEL/NETLIFY): ФС read-only, браузера нет → метаданные
     через r.jina.ai, адрес видео — из формы, запись — коммит data/posts.csv
     в GitHub (хостинг авторедеплоит). Ответ синхронный. */

const SERVERLESS = !!(process.env.VERCEL || process.env.NETLIFY);

const JOBS_DIR = () => path.join(process.cwd(), "scripts", "panel_jobs");
const PY = () => path.join(process.cwd(), "scripts", "panel_add.py");

const BADGES = new Set([
  "",
  "SWAG",
  "WELCOME TO THE FUTURE",
  "CREEPY",
  "ROCKET SCIENCE",
]);

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
  8,
);

interface PanelBody {
  url?: string;
  badge?: string;
  title?: string;
  author?: string;
  video?: string;
}

function codeFromUrl(url: string): string {
  const m = url.trim().match(/([A-Za-z0-9_-]{5,})\/?\s*$/);
  return m ? m[1] : "";
}

function isDupeInCsv(raw: string, code: string): boolean {
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return (parsed.data ?? []).some((r) => {
    const u = (r.url || "").trim();
    return u.includes(`/share/${code}/`) || u.includes(`/post/${code}`);
  });
}

/* ----------------------------- serverless ------------------------------- */

async function serverlessAdd(
  body: PanelBody,
  dryRun: boolean,
): Promise<NextResponse> {
  if (!ghEnabled()) {
    return NextResponse.json(
      {
        error:
          "GITHUB_PANEL_PAT is not set: add the token to the hosting Environment Variables and redeploy",
      },
      { status: 500 },
    );
  }

  const parsed = parsePostInput(body.url ?? "");
  if (!parsed) {
    return NextResponse.json(
      { error: "cannot parse the link — paste a Threads post link or a bare post code" },
      { status: 400 },
    );
  }

  const csvRaw = await getCsvFromGitHub();
  if (isDupeInCsv(csvRaw, parsed.code)) {
    return NextResponse.json({ error: "this post is already in the feed" }, { status: 409 });
  }

  const video = (body.video ?? "").trim();
  if (!/^https:\/\/[^\s"']+$/.test(video)) {
    return NextResponse.json(
      {
        error:
          "video URL required: open the post, right-click the video → copy video address (a ….mp4 link)",
      },
      { status: 400 },
    );
  }

  const meta = await jinaMeta(parsed.url);
  if (!meta || meta.walled) {
    return NextResponse.json(
      {
        error:
          "Threads returned no metadata (walled or unavailable). Fill in the title and author manually and try again",
      },
      { status: 502 },
    );
  }

  const title = (body.title ?? "").trim() || meta.title;
  if (!body.title?.trim() && /[а-яё]/i.test(title)) {
    return NextResponse.json(
      {
        error: `the post title is not English — put your translation into the custom title field. Original: ${title.slice(0, 120)}`,
      },
      { status: 400 },
    );
  }
  const author = (body.author ?? "").trim() || meta.author || "@unknown";

  const videoOk = await verifyVideoUrl(video);
  if (!videoOk) {
    return NextResponse.json(
      {
        error:
          "the CDN did not serve the video (206 video/mp4) — the link expired or was copied wrong. Copy the video address again",
      },
      { status: 400 },
    );
  }

  const utm = nanoid();
  const row = Papa.unparse([[parsed.url, title, author, utm, video, "", body.badge ?? "", ""]]);
  const nextCsv = `${csvRaw.replace(/\s*$/, "\n")}${row}\n`;
  const commitMessage = `panel: + ${author}${body.badge ? ` [${body.badge}]` : ""} (${parsed.code})`;

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      bytes: nextCsv.length,
      result: { code: parsed.code, utm, author, title: title.slice(0, 200), badge: body.badge ?? "" },
    });
  }

  const sha = await commitFile("data/posts.csv", nextCsv, commitMessage);
  return NextResponse.json({
    ok: true,
    mode: "serverless",
    result: {
      code: parsed.code,
      utm,
      author,
      title: title.slice(0, 200),
      badge: body.badge ?? "",
      commit: sha.slice(0, 7),
    },
  });
}

/* ------------------------- песочница (preview) -------------------------- */

async function startJob(body: PanelBody): Promise<NextResponse> {
  const url = (body.url ?? "").trim();
  const code = codeFromUrl(url);
  if (!code) {
    return NextResponse.json({ error: "no post code found in the link" }, { status: 400 });
  }
  const jobId =
    code.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) +
    "-" +
    Date.now().toString(36);

  await mkdir(JOBS_DIR(), { recursive: true });
  const logPath = path.join(JOBS_DIR(), `${jobId}.log`);
  const fh = await open(logPath, "a");
  const args = [
    PY(),
    "--url",
    url,
    "--badge",
    body.badge ?? "",
    "--title",
    body.title ?? "",
    "--job",
    jobId,
  ];
  if (body.video?.trim()) args.push("--video", body.video.trim());
  if (body.author?.trim()) args.push("--author", body.author.trim());
  const child = spawn("python3", args, {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", fh.fd, fh.fd],
  });
  child.unref();
  await fh.close();
  if (typeof child.pid !== "number") {
    return NextResponse.json({ error: "failed to start the job" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, jobId });
}

/* -------------------------------- routes -------------------------------- */

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as PanelBody | null;

  const url = (body?.url ?? "").trim();
  const badge = typeof body?.badge === "string" ? body.badge : "";
  const title = (body?.title ?? "").trim();

  if (!url || url.length > 2000) {
    return NextResponse.json({ error: "empty or too long link" }, { status: 400 });
  }
  if (!BADGES.has(badge)) {
    return NextResponse.json({ error: "unknown badge" }, { status: 400 });
  }
  if (title.length > 500) {
    return NextResponse.json({ error: "title is longer than 500 characters" }, { status: 400 });
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  if (SERVERLESS) {
    try {
      return await serverlessAdd(
        { ...(body ?? {}), url, badge, title },
        dryRun,
      );
    } catch (e) {
      return NextResponse.json(
        { error: "serverless: " + (e instanceof Error ? e.message : "?") },
        { status: 500 },
      );
    }
  }

  try {
    return await startJob({ ...(body ?? {}), url, badge, title });
  } catch (e) {
    return NextResponse.json(
      { error: "failed to start the job: " + (e instanceof Error ? e.message : "?") },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const job = searchParams.get("job");

  if (job) {
    if (!/^[a-z0-9_-]{1,120}$/.test(job)) {
      return NextResponse.json({ error: "malformed job id" }, { status: 400 });
    }
    try {
      const raw = await readFile(path.join(JOBS_DIR(), `${job}.json`), "utf-8");
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
  }

  /* список последних добавлений; на serverless читаем CSV из репо —
     бандловый может отставать от истины */
  let items: {
    code: string;
    author: string;
    badge: string;
    utm: string;
  }[] = [];
  let total = 0;

  const fromRaw = (raw: string) => {
    const parsed = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    const posts = (parsed.data ?? []).filter(
      (r) => r.url?.trim() && r.utm_code?.trim() && r.video_url?.trim(),
    );
    total = posts.length;
    items = posts.slice(-8).reverse().map((p) => ({
      code: p.url?.match(/\/share\/([A-Za-z0-9_-]+)/)?.[1] ?? "",
      author: (p.author || "").trim(),
      badge: (p.badge || "").trim(),
      utm: (p.utm_code || "").trim(),
    }));
  };

  if (SERVERLESS && ghEnabled()) {
    try {
      fromRaw(await getCsvFromGitHub());
      return NextResponse.json({ total, items, source: "github" });
    } catch {
      /* упали на GitHub — покажем бандловую копию */
    }
  }
  const posts = getPostsFromCSV();
  total = posts.length;
  items = posts.slice(-8).reverse().map((p) => ({
    code: p.url.match(/\/share\/([A-Za-z0-9_-]+)/)?.[1] ?? "",
    author: p.author,
    badge: p.badge ?? "",
    utm: p.utmCode,
  }));
  return NextResponse.json({ total, items });
}
