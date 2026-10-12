import "server-only";

import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { PROMPTS_CSV_SNAPSHOT } from "../prompts.snapshot";

/**
 * Сервер-онли слой платных промптов.
 *
 * Почему prompt_full живёт ЗДЕСЬ, а не в FeedPost: posts.csv сериализуется
 * в клиентский RSC-пейлоад целиком — любой колонке там можно доверять
 * только «публичное» (цена, тизер, кошелёк автора). Полный текст хранится
 * отдельно (data/prompts.csv + снапшот) и отдаётся исключительно через
 * /api/prompts/[code]/status ПОСЛЕ подтверждённой оплаты.
 */

export interface PromptEntry {
  utmCode: string;
  promptFull: string;
}

interface PromptCache {
  mtimeMs: number;
  byCode: Map<string, string>;
}

const SNAPSHOT_MTIME = -2;
const EMPTY: PromptCache = { mtimeMs: -1, byCode: new Map() };

let cache: PromptCache | null = null;

function load(): PromptCache {
  let mtimeMs: number;
  let raw: string;

  try {
    const p = path.join(process.cwd(), "data", "prompts.csv");
    mtimeMs = fs.statSync(p).mtimeMs;
    raw = fs.readFileSync(p, "utf-8");
  } catch {
    // serverless: файл не попал в бандл — встроенная серверная копия
    mtimeMs = SNAPSHOT_MTIME;
    raw = PROMPTS_CSV_SNAPSHOT;
  }

  if (cache && cache.mtimeMs === mtimeMs) return cache;

  const byCode = new Map<string, string>();
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  for (const row of parsed.data) {
    const code = (row.utm_code || "").trim();
    const full = (row.prompt_full || "").trim();
    if (code && full) byCode.set(code, full);
  }

  cache = { mtimeMs, byCode };
  return cache;
}

export function getPromptFull(code: string): string | null {
  return load().byCode.get(code) ?? null;
}

/* ---------------- комиссия и разделение суммы ---------------- */

export function commissionRate(): number {
  const raw = Number.parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? "0.25");
  if (!Number.isFinite(raw)) return 0.25;
  // разумные границы: платформа не может забрать больше 90%
  return Math.min(Math.max(raw, 0), 0.9);
}

/**
 * Разделение цены на комиссию платформы и выплату автору.
 *
 * Деньги считаем в «микро-USDT» (целые, 1 USDT = 1_000_000), чтобы не
 * ловить плавающую точку: 0.1 + 0.2 !== 0.3. Decimal-строки — по
 * инварианту документации 2328 («send and store money as strings»).
 */
export function calcSplit(
  priceUsdt: string,
  rate = commissionRate()
): { platformFee: string; sellerAmount: string } {
  const micros = toMicros(priceUsdt);
  const fee = Math.round(micros * rate);
  const seller = micros - fee;
  return {
    platformFee: fromMicros(fee),
    sellerAmount: fromMicros(seller),
  };
}

function toMicros(decimal: string): number {
  const n = Number.parseFloat(decimal || "0");
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1_000_000);
}

function fromMicros(micros: number): string {
  return (Math.max(0, micros) / 1_000_000).toFixed(6);
}
