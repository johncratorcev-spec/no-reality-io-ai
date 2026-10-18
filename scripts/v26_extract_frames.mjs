#!/usr/bin/env node
/**
 * v26 — прицельное извлечение + кадры для классификации.
 * Скоп ДЛЯ ГЛАВНОГО ПОСТА: article (не related threads).
 * Кадры: seek 30% и 65% длительности, пауза, скрин.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

const AB = "/home/z/.bun/install/global/node_modules/agent-browser/bin/agent-browser-linux-x64";
const OUT = "/tmp/v26_extract";
mkdirSync(OUT, { recursive: true });

const LINKS = [
  "BAFlXcFGIM", "BACRfexmcs", "BAOae9mS6I", "BAcXZq7jFB", "_paRxlBpt",
  "BApb_G708_", "BAZTVfLNoA", "_6gx0GNBq", "BCMC1ZQX-H",
];

function ab(...args) {
  return execFileSync(AB, args, { timeout: 60000, encoding: "utf-8" }).trim();
}
function unwrap(raw) {
  let s = raw.split("\n").filter(Boolean).join("\n");
  try { const p = JSON.parse(s); if (typeof p === "string") return p; } catch {}
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

const EXPR = `(() => {
  const main = document.querySelector("article");
  const root = main || document;
  const vids = Array.from(root.querySelectorAll("video"))
    .map(v => ({ src: v.src || (v.querySelector("source")&&v.querySelector("source").src) || "", dur: v.duration||0, w: v.videoWidth||0, h: v.videoHeight||0 }))
    .filter(v => v.src);
  const imgs = Array.from(root.querySelectorAll("img"))
    .map(i => i.src).filter(s => s.includes("cdninstagram")||s.includes("fbcdn"))
    .filter((s, i, a) => a.indexOf(s) === i);
  const capEl = root.querySelector('div[dir="ltr"]');
  const caption = capEl ? capEl.innerText : "";
  const userEl = (main || document).querySelector('a[href*="/@"]');
  const author = userEl ? ((userEl.getAttribute("href")||"").match(/@([a-z0-9_.]+)/i)||[])[1] || "" : "";
  return JSON.stringify({ vids: vids.slice(0,3), imgs: imgs.slice(0,10), caption: (caption||"").slice(0,300), author, hasArticle: !!main });
})()`;

for (const id of LINKS) {
  process.stdout.write(`=== ${id} ===\n`);
  try {
    ab("open", `https://www.threads.com/share/${id}/`);
    try { ab("wait", "--load", "networkidle"); } catch {}
    ab("wait", "4000");
    /* закрыть модалку логина */
    try { ab("press", "Escape"); } catch {}
    ab("wait", "2500");
    let data = null;
    for (let i = 1; i <= 6; i++) {
      try {
        const p = JSON.parse(unwrap(ab("eval", EXPR)));
        if (p && (p.vids?.length || p.imgs?.length) && p.hasArticle) { data = p; break; }
        if (p && (p.vids?.length || p.imgs?.length) && i >= 4) { data = p; break; }
      } catch {}
      ab("wait", "4000");
    }
    if (!data) { process.stdout.write("  → НЕ НАЙДЕНО\n"); continue; }

    if (data.vids.length) {
      const v = data.vids[0];
      const seek = `(() => { const vs=document.querySelectorAll("article video"); const v=vs[0]||document.querySelector("video"); if(!v) return "nov"; v.pause(); try { v.currentTime = Math.min((v.duration||10)*0.3, v.duration-0.5); } catch{}; return String(v.currentTime); })()`;
      try { ab("eval", seek); } catch {}
      ab("wait", "2500");
      try { ab("screenshot", `${OUT}/${id}_f1.png`); } catch {}
      try { ab("eval", `(() => { const v=document.querySelector("article video")||document.querySelector("video"); if(!v) return "nov"; try { v.currentTime = Math.min((v.duration||10)*0.65, v.duration-0.5); } catch{}; return "ok"; })()`); } catch {}
      ab("wait", "2000");
      try { ab("screenshot", `${OUT}/${id}_f2.png`); } catch {}
      process.stdout.write(`  video: ${v.src.slice(0, 80)}… (${v.w}x${v.h}, ${Math.round(v.dur)}s)\n`);
    } else {
      process.stdout.write(`  CAROUSEL: ${data.imgs.length} imgs, первый: ${data.imgs[0]?.slice(0, 70)}\n`);
      try { ab("screenshot", `${OUT}/${id}_f1.png`); } catch {}
    }
    process.stdout.write(`  author: @${data.author} | caption: ${(data.caption || "—").replace(/\n/g, " / ").slice(0, 120)}\n`);
    /* мержим с прежним извлечением */
    const file = `${OUT}/${id}.json`;
    const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    writeFileSync(file, JSON.stringify({ ...prev, main: data }, null, 2));
  } catch (e) {
    process.stdout.write(`  FAIL: ${String(e.message).slice(0, 90)}\n`);
  }
  execFileSync("sleep", ["2"]);
}
process.stdout.write("DONE\n");
