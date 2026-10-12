"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* no reality. / control — приватная панель добавления постов в ленту.
   Доступ по секретному пути (без авторизации). Минимализм: белый фон,
   волосатые линии, ч/б чипы бейджей, моно-консоль прогресса. */

const BADGES = ["SWAG", "WELCOME TO THE FUTURE", "CREEPY", "ROCKET SCIENCE"];

type JobResult = {
  code: string;
  utm: string;
  author: string;
  title: string;
  badge: string;
  video?: string;
  commit?: string;
  pending?: boolean;
};

type JobStatus = {
  id?: string;
  state?: "running" | "done" | "error";
  log?: string[];
  error?: string | null;
  result?: JobResult | null;
};

type ListItem = { code: string; author: string; badge: string; utm: string };

export default function ControlPanelPage() {
  const pathname = usePathname();
  const API = `${pathname}/add`;
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [video, setVideo] = useState("");
  const [badge, setBadge] = useState("");
  const [job, setJob] = useState<JobStatus | null>(null);
  const [formError, setFormError] = useState("");
  const [starting, setStarting] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [recent, setRecent] = useState<ListItem[]>([]);
  const startedAt = useRef(0);

  const refreshList = useCallback(async () => {
    try {
      const r = await fetch(API, { cache: "no-store" });
      const d = await r.json();
      if (typeof d.total === "number") setTotal(d.total);
      if (Array.isArray(d.items)) setRecent(d.items);
    } catch {
      /* тихо — список вторичен */
    }
  }, [API]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  /* поллинг статуса джобы */
  useEffect(() => {
    if (!job?.id || job.state !== "running") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API}?job=${job.id}`, { cache: "no-store" });
        const d: JobStatus & { error?: string } = await r.json();
        if (d.state) {
          setJob(d);
          if (d.state !== "running") refreshList();
        } else if (d.error) {
          setJob((j) => j && { ...j, state: "error", error: d.error ?? "job record lost" });
        }
      } catch {
        /* сеть моргнула — следующая итерация доведёт */
      }
      if (Date.now() - startedAt.current > 10 * 60 * 1000) {
        setJob((j) => j && { ...j, state: "error", error: "timeout (10 min)" });
      }
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.state, refreshList, API]);

  const submit = async () => {
    setFormError("");
    if (!url.trim()) {
      setFormError("paste the post link");
      return;
    }
    setStarting(true);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, badge, title, author, video }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFormError(d.error || "failed to start the add");
        return;
      }
      if (d.jobId) {
        startedAt.current = Date.now();
        setJob({ id: d.jobId, state: "running", log: ["job started…"] });
      } else if (d.result) {
        /* serverless: ответ синхронный, деплой приедет через 1–2 минуты */
        setJob({
          state: "done",
          log: d.dryRun
            ? ["dry run — no commit was made"]
            : [`commit ${d.result.commit} landed in the repo`, "the deploy arrives in 1–2 minutes"],
          result: { ...d.result, pending: !d.dryRun },
        });
        refreshList();
      }
    } catch {
      setFormError("network unavailable — try again");
    } finally {
      setStarting(false);
    }
  };

  const running = job?.state === "running";
  const logLines = job?.log ?? [];

  return (
    <main className="min-h-screen bg-white text-[#1B1523] font-[family-name:var(--font-manrope)]">
      <div className="mx-auto max-w-md px-5 py-10">
        {/* header */}
        <header className="flex items-baseline justify-between">
          <h1 className="text-lg font-extrabold tracking-tight">
            no reality. <span className="font-medium text-neutral-400">/ control</span>
          </h1>
          <span className="font-mono text-xs text-neutral-400">
            [{total ?? "…"}]
          </span>
        </header>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
          paste a Threads post link — it will load itself into the feed
        </p>

        {/* form */}
        <section className="mt-8 space-y-7">
          <div>
            <label htmlFor="nr-url" className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              post link
            </label>
            <input
              id="nr-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.threads.com/share/…"
              autoComplete="off"
              spellCheck={false}
              disabled={running}
              className="mt-1 w-full border-b-2 border-neutral-200 bg-transparent py-2 text-sm outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-900 disabled:opacity-40"
            />
          </div>

          <div>
            <label htmlFor="nr-title" className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              custom title <span className="font-medium normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="nr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="if the post has no description or it is not in English"
              autoComplete="off"
              disabled={running}
              className="mt-1 w-full border-b-2 border-neutral-200 bg-transparent py-2 text-sm outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-900 disabled:opacity-40"
            />
          </div>

          <div>
            <label htmlFor="nr-author" className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              author <span className="font-medium normal-case tracking-normal">(if detected wrong)</span>
            </label>
            <input
              id="nr-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="@username"
              autoComplete="off"
              spellCheck={false}
              disabled={running}
              className="mt-1 w-full border-b-2 border-neutral-200 bg-transparent py-2 text-sm outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-900 disabled:opacity-40"
            />
          </div>

          <div>
            <label htmlFor="nr-video" className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              video address <span className="font-medium normal-case tracking-normal">(required on Vercel)</span>
            </label>
            <input
              id="nr-video"
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="right-click the video in the post → copy video address (….mp4)"
              autoComplete="off"
              spellCheck={false}
              disabled={running}
              className="mt-1 w-full border-b-2 border-neutral-200 bg-transparent py-2 text-sm outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-900 disabled:opacity-40"
            />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              badge
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip selected={badge === ""} disabled={running} onClick={() => setBadge("")}>
                no badge
              </Chip>
              {BADGES.map((b) => (
                <Chip key={b} selected={badge === b} disabled={running} onClick={() => setBadge(b)}>
                  {b}
                </Chip>
              ))}
            </div>
          </div>

          {formError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700">
              {formError}
            </p>
          )}

          <button
            onClick={submit}
            disabled={starting || running}
            className="w-full rounded-full bg-neutral-900 py-3.5 text-xs font-extrabold uppercase tracking-[0.25em] text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {running ? "working…" : starting ? "starting…" : "add to the feed"}
          </button>
        </section>

        {/* console */}
        {job && (
          <section className="mt-8" aria-live="polite">
            <div className="rounded-xl border border-neutral-200 p-4 font-mono text-[11px] leading-relaxed">
              {logLines.length === 0 && <p className="text-neutral-400">waiting for status…</p>}
              {logLines.map((line, i) => (
                <p
                  key={i}
                  className={
                    i === logLines.length - 1
                      ? running
                        ? "text-neutral-900"
                        : job.state === "error"
                          ? "text-red-700"
                          : "text-neutral-900"
                      : "text-neutral-400"
                  }
                >
                  <span className="mr-1 text-neutral-300">›</span>
                  {line}
                  {i === logLines.length - 1 && running && (
                    <span className="ml-0.5 animate-pulse">▌</span>
                  )}
                </p>
              ))}
            </div>

            {/* success card */}
            {job.state === "done" && job.result && (
              <div className="mt-4 rounded-xl border border-neutral-900 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold">{job.result.author}</span>
                  {job.result.badge && (
                    <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-white">
                      {job.result.badge}
                    </span>
                  )}
                </div>
                {job.result.title && (
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-neutral-500">
                    {job.result.title}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  {job.result.pending ? (
                    <span className="font-mono text-xs text-neutral-400">
                      /v/{job.result.utm} — after the deploy
                    </span>
                  ) : (
                    <a
                      href={`/v/${job.result.utm}`}
                      target="_blank"
                      className="font-mono text-xs underline underline-offset-4 hover:text-neutral-500"
                    >
                      /v/{job.result.utm}
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setJob(null);
                      setUrl("");
                      setTitle("");
                      setAuthor("");
                      setVideo("");
                      setBadge("");
                    }}
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-900"
                  >
                    next →
                  </button>
                </div>
              </div>
            )}

            {/* error card */}
            {job.state === "error" && job.error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs leading-relaxed text-red-700">{job.error}</p>
                <button
                  onClick={() => {
                    setJob(null);
                    setUrl("");
                  }}
                  className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 hover:text-red-700"
                >
                  reset →
                </button>
              </div>
            )}
          </section>
        )}

        {/* recent */}
        <section className="mt-12">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            recent additions
          </h2>
          <ul className="mt-2">
            {recent.length === 0 && (
              <li className="py-2 font-mono text-[11px] text-neutral-300">empty</li>
            )}
            {recent.map((p) => (
              <li
                key={p.utm}
                className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 font-mono text-[11px]"
              >
                <span className="truncate text-neutral-600">
                  {p.code && <span className="text-neutral-300">{p.code} </span>}
                  {p.author}
                </span>
                {p.badge ? (
                  <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                    {p.badge}
                  </span>
                ) : (
                  <span className="shrink-0 text-[9px] text-neutral-300">—</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-12 text-center font-mono text-[9px] text-neutral-300">
          add panel · access by secret link only
        </footer>
      </div>
    </main>
  );
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}
