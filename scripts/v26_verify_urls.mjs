#!/usr/bin/env node
/**
 * v26 — верификация извлечённых URL (Range-проба как в рантайме)
 */
import { readFileSync, existsSync } from "node:fs";

const LINKS = [
  "BAFlXcFGIM", "BACRfexmcs", "BAOae9mS6I", "BAcXZq7jFB",
  "BApb_G708_", "BAZTVfLNoA", "_6gx0GNBq", "BCMC1ZQX-H",
];

async function alive(url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(15000) });
    const ct = r.headers.get("content-type") || "";
    if (r.status === 206 || r.status === 200) {
      if (ct.includes("video") || ct === "" || ct.includes("octet-stream")) return "206-video";
      return `${r.status}-${ct.slice(0, 30)}`;
    }
    /* фолбэк без Range (ловушка c89a631) */
    const r2 = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return `fallback ${r2.status}-${(r2.headers.get("content-type") || "").slice(0, 30)}`;
  } catch (e) {
    return `ERR ${String(e.message).slice(0, 40)}`;
  }
}

for (const id of LINKS) {
  const f = `/tmp/v26_extract/${id}.json`;
  if (!existsSync(f)) { console.log(`${id}: NO JSON`); continue; }
  const d = JSON.parse(readFileSync(f, "utf8"));
  const v = d.main?.vids?.[0] || d.vidsAll?.[0];
  if (!v) { console.log(`${id}: no video`); continue; }
  const res = await alive(v.src);
  console.log(`${id}: ${res} (${v.w}x${v.h}, ${Math.round(v.dur)}s) ${v.src.slice(0, 60)}…`);
}
