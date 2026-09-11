/* Smoke-test serverless-ветки панели без HTTP-слоя (Node 24 type stripping).
   Запуск: GITHUB_PANEL_PAT=... node scripts/test_serverless.ts
   Коммитит no-op (идентичный CSV) — проверяет write-путь GitHub API. */
import { getCsvFromGitHub, ghEnabled, commitFile } from "../src/lib/panel_github.ts";
import { jinaMeta, verifyVideoUrl, parsePostInput } from "../src/lib/panel_extract.ts";

const p = (label: string, v: unknown) => console.log(`${label}:`, v);

p("ghEnabled", ghEnabled());

const csv = await getCsvFromGitHub();
p("csv lines", csv.trimEnd().split("\n").length);
p("dupe BAVq1ma_VU", csv.includes("/share/BAVq1ma_VU/"));

const vid = csv.split("\n").find((l) => l.includes("BAVq1ma_VU"))?.match(/,(https:\/\/[^,]*\.mp4[^,]*),/)?.[1] ?? "";
p("video found", vid.slice(0, 60));
p("verifyVideoUrl", await verifyVideoUrl(vid));

const meta = await jinaMeta("https://www.threads.com/share/_gYuRN9lp/");
p("jina author", meta?.author);
p("jina title", meta?.title.slice(0, 80));
p("jina walled", meta?.walled);

p("parsePostInput bare", parsePostInput("_8h16T9aG"));
p("parsePostInput post-url", parsePostInput("https://www.threads.com/@x/post/123/"));

/* no-op коммит: идентичное содержимое — диффа нет, путь проверен */
const sha = await commitFile("data/posts.csv", csv, "chore: panel smoke test (no-op commit)");
p("commit sha", sha);
console.log("SERVERLESS SMOKE OK");
