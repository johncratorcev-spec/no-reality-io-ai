/* GitHub как постоянное хранилище панели на serverless (Vercel/Netlify):
   там ФС read-only и нет python/agent-browser, поэтому панель читает
   data/posts.csv из репо и коммитит изменения через Git Data API —
   хостинг подхватывает новый коммит авторедеплоем. */

const REPO = "johncratorcev-spec/no-reality-io-ai";
const API = "https://api.github.com";

function pat(): string {
  return process.env.GITHUB_PANEL_PAT || process.env.GITHUB_TOKEN || "";
}

export function ghEnabled(): boolean {
  return pat() !== "";
}

async function gh(pathname: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "no-reality-panel",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
}

/** Текущий data/posts.csv из репо (истина для прода). */
export async function getCsvFromGitHub(): Promise<string> {
  const r = await gh(`/repos/${REPO}/contents/data/posts.csv?ref=main`);
  if (!r.ok) throw new Error(`github: не прочитал posts.csv (${r.status})`);
  const d = (await r.json()) as { content?: string; encoding?: string };
  if (d.encoding !== "base64" || !d.content) {
    throw new Error("github: CSV пришёл не в base64");
  }
  return Buffer.from(d.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

/** Коммит одного файла в main одним коммитом. Возвращает sha коммита. */
export async function commitFile(
  path: string,
  content: string,
  message: string,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const refR = await gh(`/repos/${REPO}/git/ref/heads/main`);
    if (!refR.ok) throw new Error(`github: не прочитал ref (${refR.status})`);
    const headSha = ((await refR.json()) as { object: { sha: string } }).object.sha;

    const cR = await gh(`/repos/${REPO}/git/commits/${headSha}`);
    if (!cR.ok) throw new Error(`github: не прочитал коммит (${cR.status})`);
    const treeSha = ((await cR.json()) as { tree: { sha: string } }).tree.sha;

    const newTreeR = await gh(`/repos/${REPO}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: treeSha,
        tree: [{ path, mode: "100644", type: "blob", content }],
      }),
    });
    if (!newTreeR.ok) throw new Error(`github: не собрал дерево (${newTreeR.status})`);
    const newTree = ((await newTreeR.json()) as { sha: string }).sha;

    const commitR = await gh(`/repos/${REPO}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: newTree, parents: [headSha] }),
    });
    if (!commitR.ok) throw new Error(`github: не собрал коммит (${commitR.status})`);
    const newSha = ((await commitR.json()) as { sha: string }).sha;

    const patchR = await gh(`/repos/${REPO}/git/refs/heads/main`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newSha, force: false }),
    });
    if (patchR.ok) return newSha;
    /* 409/422 — кто-то запушил раньше нас: перечитываем и пробуем ещё раз */
    if (attempt === 0 && (patchR.status === 409 || patchR.status === 422)) continue;
    throw new Error(`github: не двигнул ref (${patchR.status})`);
  }
  throw new Error("github: ref не обновился после ретрая");
}
