#!/usr/bin/env node
/**
 * v16: общий хелпер selftest-сессий (замена удалённым password/telegram
 * auth-роутам — единственный вход теперь Google, он покрыт google_selftest
 * и v16_auth_smoke). Создаёт Account НАПРЯМУЮ в БД с тем же состоянием,
 * которое раньше давала регистрация (signup_bonus +100, passTier=1,
 * LedgerTxn с refKey signup:<id> — «welcome ровно раз»), и возвращает
 * cookie-пару nr_uid + nr_auth (та же подпись, что lib/auth/session).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { q, one } from "./supadb.mjs";

function envOf(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
      .split("\n")
      .find((l) => l.startsWith(name + "="));
    return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
  } catch {
    return "";
  }
}

function authCookieValue(uid) {
  const secret =
    envOf("SESSION_SECRET") || envOf("ADMIN_SECRET") || "no-reality-dev-session-secret";
  return (
    "v1." +
    createHmac("sha256", secret)
      .update(`nr-auth:${uid}`)
      .digest("base64url")
      .slice(0, 32)
  );
}

/**
 * Создать аккаунт и вернуть { accountId, cookies, email }.
 * options: { email?, bonusCents? (дефолт 100), passTier? (дефолт 1), bonusKind? }
 * cookies — готовая строка для fetch-заголовка: "nr_uid=…; nr_auth=…".
 */
export async function createSelfSession(options = {}) {
  const email = options.email || `self-${randomUUID().slice(0, 8)}@test.local`;
  const bonus = options.bonusCents ?? 100;
  const passTier = options.passTier ?? 1;
  const id = randomUUID();
  await q(
    `INSERT INTO "Account" (id, email, "balanceCents", "passTier", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, now(), now())`,
    [id, email, bonus, passTier]
  );
  if (bonus !== 0) {
    await q(
      `INSERT INTO "LedgerTxn" (id, "accountId", delta, kind, "refKey", "createdAt")
       VALUES ($1, $2, $3, $4, $5, now())`,
      [randomUUID(), id, bonus, options.bonusKind || "signup_bonus", `signup:${id}`]
    );
  }
  const cookies = `nr_uid=${id}; nr_auth=${authCookieValue(id)}`;
  return { accountId: id, cookies, email };
}

/** Удалить аккаунт и его ledger (cleanup). */
export async function dropSelfSession(accountId) {
  if (!accountId) return;
  try {
    await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [accountId]);
    await q('DELETE FROM "Account" WHERE id = $1', [accountId]);
  } catch {
    /* cleanup best-effort */
  }
}

/** Подписанное значение nr_auth для СУЩЕСТВУЮЩего аккаунта (без вставки). */
export function sessionCookieFor(accountId) {
  return `nr_uid=${accountId}; nr_auth=${authCookieValue(accountId)}`;
}

export const __selftest_marker = one;
