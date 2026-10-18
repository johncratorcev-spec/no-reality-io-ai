#!/usr/bin/env node
/**
 * v26 — извлечение медиа/автора/подписи из 9 новых Threads-постов.
 * Методика v23_refresh_11 (agent-browser, поллинг <video>, CLI печатает
 * результат eval КАК JSON-строку в кавычках — снимаем обёртку).
 * Результат: /tmp/v26_extract/<id>.json (машиночитаемый) + <id>.png (кадр).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

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

/** CLI возвращает JSON.stringify(строка) — снимаем внешние кавычки */
function unwrap(raw) {
  let s = raw.split("\n").filter(Boolean).join("\n");
  try {
    const p = JSON.parse(s);
    if (typeof p === "string") return p;
  } catch {}
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

const EXPR = `(() => {
  const vids = Array.from(document.querySelectorAll("video"))
    .map(v => v.src || (v.querySelector("source") && v.querySelector("source").src))
    .filter(Boolean);
  const vidsAll = Array.from(document.querySelectorAll("video")).map(v => ({
    src: v.src || (v.querySelector("source") && v.querySelector("source").src) || "",
    dur: v.duration || 0, w: v.videoWidth || 0, h: v.videoHeight || 0,
  }));
  const imgs = Array.from(document.querySelectorAll("img"))
    .map(i => i.src).filter(s => s.includes("cdninstagram") || s.includes("fbcdn"));
  /* подпись: первый текстовый блок поста */
  const captionEl = document.querySelector('[data-pressable-container="true"] div[dir="ltr"] span') ||
                    document.querySelector('article span');
  const caption = captionEl ? captionEl.closest('div[dir="ltr"]')?.innerText || captionEl.innerText : "";
  const userEl = document.querySelector('a[href*="/@"]');
  const author = userEl ? (userEl.getAttribute("href").match(/@([a-z0-9_.]+)/i) || [])[1] || "" : "";
  return JSON.stringify({ vidsAll, imgs: imgs.slice(0, 10), caption: (caption || "").slice(0, 300), author, url: location.href });
})()`;

for (const id of LINKS) {
  process.stdout.write(`=== ${id} ===\n`);
  try {
    ab("open", `https://www.threads.com/share/${id}/`);
    try { ab("wait", "--load", "networkidle"); } catch {}
    ab("wait", "4000");
    let data = null;
    for (let i = 1; i <= 6; i++) {
      try {
        const raw = ab("eval", EXPR);
        const cleaned = unwrap(raw);
        const p = JSON.parse(cleaned);
        if (p && (p.vidsAll?.length || p.imgs?.length)) { data = p; break; }
      } catch (e) {
        process.stdout.write(`  poll ${i}: ${String(e.message).slice(0, 60)}\n`);
      }
      ab("wait", "4000");
    }
    if (!data) {
      process.stdout.write("  → МЕДИА НЕ НАЙДЕНО\n");
      continue;
    }
    /* скрин кадра для классификации */
    try { ab("screenshot", `${OUT}/${id}.png`); } catch {}
    /* подпись иногда видна только после закрытия модалки — второй проход по DOM */
    writeFileSync(`${OUT}/${id}.json`, JSON.stringify(data, null, 2));
    process.stdout.write(`  author: @${data.author} | videos: ${data.vidsAll.length} | imgs: ${data.imgs.length}\n`);
    process.stdout.write(`  caption: ${(data.caption || "—").slice(0, 140)}\n`);
    for (const v of data.vidsAll) process.stdout.write(`  video: ${v.src.slice(0, 100)}… (${v.w}x${v.h}, ${Math.round(v.dur)}s)\n`);
  } catch (e) {
    process.stdout.write(`  FAIL: ${String(e.message).slice(0, 100)}\n`);
  }
  /* анти-троттлинг */
  execFileSync("sleep", ["2"]);
}
process.stdout.write("DONE\n");
