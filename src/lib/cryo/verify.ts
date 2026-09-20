/**
 * Верификация USDC-ставки Cryo-Stop (упрощённая архитектура).
 *
 * Ставка = прямой перевод USDC (любая сумма) на казначея (Phantom → SPL transfer
 * c memo). Проверка — ОДИН вызов публичного Solana RPC (бесплатно,
 * без @solana/web3.js на сервере):
 *   1) транзакция существует и успешна (meta.err === null);
 *   2) среди token-балансов есть дельта ≥ $1 по минту USDC на владельце-
 *      казначее (meta.preTokenBalances → postTokenBalances, owner == CRYO.treasury);
 *   3) memo транзакции содержит betRef (анти-реплей: ссылка уникальна
 *      для каждой ставки).
 *
 * Любой транспортный сбой RPC → ok:false с reason:"rpc" — вызывающий код
 * решает: записать позицию с txSig (reconcile вручную) или отклонить.
 */
import { CRYO } from "./config";

interface TokenBalance {
  accountIndex: number;
  owner?: string;
  mint?: string;
  uiTokenAmount?: { uiAmount?: number | null };
}

interface GetTxResult {
  meta?: {
    err: unknown;
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
}

export interface VerifyUsdcResult {
  ok: boolean;
  /** "rpc" — транспорт/лимиты (позицию можно записать на reconcile);
   *  "tx" — транзакция не прошла проверку (отклонять) */
  reason?: "rpc" | "tx" | "config";
  amountUsdc?: number;
}

export async function verifyUsdcBet(args: {
  txSig: string;
  betRef: string;
  expectedUsdc: number;
}): Promise<VerifyUsdcResult> {
  if (!CRYO.treasury) {
    return { ok: false, reason: "config" };
  }

  let tx: GetTxResult | null = null;
  try {
    const r = await fetch(CRYO.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          args.txSig,
          {
            encoding: "jsonParsed",
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return { ok: false, reason: "rpc" };
    const j = (await r.json()) as { result?: GetTxResult | null };
    tx = j.result ?? null;
  } catch {
    return { ok: false, reason: "rpc" };
  }

  if (!tx || !tx.meta || tx.meta.err) {
    return { ok: false, reason: "tx" };
  }

  // дельта USDC на казначее по token-балансам
  const pre = new Map<number, number>();
  for (const b of tx.meta.preTokenBalances ?? []) {
    pre.set(b.accountIndex, b.uiTokenAmount?.uiAmount ?? 0);
  }
  let received = 0;
  for (const b of tx.meta.postTokenBalances ?? []) {
    if (b.owner !== CRYO.treasury) continue;
    if (b.mint && b.mint !== CRYO.usdcMint) continue;
    const before = pre.get(b.accountIndex) ?? 0;
    const after = b.uiTokenAmount?.uiAmount ?? 0;
    received = Math.max(received, after - before);
  }

  if (!(received >= args.expectedUsdc - 1e-9)) {
    return { ok: false, reason: "tx" };
  }

  // memo: betRef должен присутствовать в транзакции (анти-реплей)
  if (args.betRef && !JSON.stringify(tx).includes(args.betRef)) {
    return { ok: false, reason: "tx" };
  }

  return { ok: true, amountUsdc: received };
}
