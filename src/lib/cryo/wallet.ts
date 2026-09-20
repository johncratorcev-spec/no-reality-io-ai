"use client";

/**
 * Cryo-Stop кошелёк (Block 5 спеки): one-tap исполнение через Phantom.
 *
 * Приоритет провайдеров:
 *   1) Phantom (window.phantom.solana) — Solana: USDC → Outcome_Token
 *      через Jupiter Aggregator (real-режим, когда задан CRYO_JUPITER_OUTPUT_MINT);
 *   2) EIP-1193 (MetaMask) — EVM USDC-позиция;
 *   3) demo — стабильный гостевой адрес (демо-реестр позиций, тот же UX).
 *
 * В реальном режиме происходит signAndSendTransaction(swapTransaction) —
 * пользователь видит стандартный защищённый поп-ап Phantom. Пока Outcome-токен
 * не выпущен, exchange:"demo" — сервер сообщает режим, UX идентичен.
 */

export interface CryoWallet {
  /** адрес позиции (Solana base58 / EVM 0x… / demo:guest-…) */
  address: string;
  provider: "phantom" | "metamask" | "demo";
}

const GUEST_KEY = "nr-cryo-wallet";

interface SolanaPhantom {
  isPhantom?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction?(tx: unknown): Promise<{ signature: string }>;
}

function phantomProvider(): SolanaPhantom | null {
  if (typeof window === "undefined") return null;
  const p = (window as unknown as { phantom?: { solana?: SolanaPhantom } }).phantom;
  return p?.solana?.isPhantom ? p.solana : null;
}

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function evmProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  return eth && typeof eth.request === "function" ? eth : null;
}

function guestWallet(): CryoWallet {
  try {
    const saved = localStorage.getItem(GUEST_KEY);
    if (saved && /^demo:guest-[a-z0-9]{10}$/.test(saved)) {
      return { address: saved, provider: "demo" };
    }
    const rnd = Array.from({ length: 10 }, () =>
      Math.floor(Math.random() * 36).toString(36)
    ).join("");
    const addr = `demo:guest-${rnd}`;
    localStorage.setItem(GUEST_KEY, addr);
    return { address: addr, provider: "demo" };
  } catch {
    return { address: "demo:guest-anonymous", provider: "demo" };
  }
}

/** Стабильный кошелёк позиции: Phantom → MetaMask → demo-гость */
export async function ensureCryoWallet(): Promise<CryoWallet> {
  const ph = phantomProvider();
  if (ph) {
    try {
      const res = await ph.connect();
      const addr = res?.publicKey?.toString();
      if (addr) return { address: addr, provider: "phantom" };
    } catch {
      /* пользователь отклонил — падаем ниже */
    }
  }
  const evm = evmProvider();
  if (evm) {
    try {
      const accs = (await evm.request({ method: "eth_requestAccounts" })) as string[];
      const addr = accs?.[0];
      if (addr) return { address: addr.toLowerCase(), provider: "metamask" };
    } catch {
      /* отклонено — demo */
    }
  }
  return guestWallet();
}

/**
 * Read-only identity для поллинга рынков (НИКАКИХ поп-апов):
 * 1) сессия MetaMask-cookie (если была) — иначе 2) гостевой адрес из
 * localStorage (если уже создавался) — иначе null. Новых гостей не создаём:
 * identity фиксируется только в момент ставки.
 */
export async function peekCryoWallet(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch("/api/auth/metamask", { cache: "no-store" });
    if (r.ok) {
      const d = (await r.json()) as { wallet?: string | null };
      if (d.wallet) return d.wallet.toLowerCase();
    }
  } catch {
    /* сессии нет — ок */
  }
  try {
    const saved = localStorage.getItem(GUEST_KEY);
    if (saved && /^demo:guest-[a-z0-9]{10}$/.test(saved)) return saved;
  } catch {
    /* приватный режим */
  }
  return null;
}

export interface SwapResult {
  mode: "phantom" | "demo";
  txSig: string | null;
  error?: string;
}

/**
 * Атомарный обмен $1 USDC → Outcome_Token (Block 5).
 *
 * jupiter-режим: quote-api Jupiter → signAndSendTransaction в Phantom.
 * demo-режим: защищённая симуляция поп-апа (тот же UX, позиция в реестре).
 * Любая ошибка реального свапа → деградация в demo (позиция не теряется).
 */
export async function executeCryoSwap(args: {
  exchange: "demo" | "jupiter";
  inputMint: string;
  outputMint: string;
  amountUsdc: string; // "1.00"
}): Promise<SwapResult> {
  const ph = phantomProvider();
  const amountMicro = Math.round(parseFloat(args.amountUsdc) * 1_000_000);

  if (
    args.exchange === "jupiter" &&
    ph?.signAndSendTransaction &&
    args.inputMint &&
    args.outputMint
  ) {
    try {
      const qs = new URLSearchParams({
        inputMint: args.inputMint,
        outputMint: args.outputMint,
        amount: String(amountMicro),
        slippageBps: "50",
      });
      const r = await fetch(`https://quote-api.jup.ag/v6/quote?${qs}`);
      if (!r.ok) throw new Error(`jupiter quote ${r.status}`);
      const quote = await r.json();
      const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: (await ph.connect()).publicKey.toString(),
          wrapAndUnwrapSol: true,
        }),
      });
      if (!swapRes.ok) throw new Error(`jupiter swap ${swapRes.status}`);
      const { swapTransaction } = await swapRes.json();
      // защищённый поп-ап Phantom: пользователь подписывает и отправляет
      const signed = await ph.signAndSendTransaction(
        JSON.parse(atob(swapTransaction))
      );
      return { mode: "phantom", txSig: signed.signature };
    } catch (e) {
      // отклонено/неуспех → фиксируем как demo-позицию (UX-фолбэк)
      return {
        mode: "demo",
        txSig: null,
        error: e instanceof Error ? e.message : "swap failed",
      };
    }
  }

  // demo: поп-ап рисует CryoStopCard (ProtectedOverlay), задержка имитирует сеть
  await new Promise((r) => setTimeout(r, 1400));
  return { mode: "demo", txSig: null };
}
