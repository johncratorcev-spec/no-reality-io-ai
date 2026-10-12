"use client";

/**
 * Cryo-Stop кошелёк (task 42, упрощённая архитектура: приём ТОЛЬКО USDC).
 *
 * Приоритет identity:
 *   1) сессия Phantom на сайте (cookie nr_phantom — авторизация task 42);
 *   2) Phantom one-tap: connect + sign-in + перевод USDC (любая сумма) на казначея;
 *   3) demo — стабильный гостевой адрес (тот же UX, без on-chain).
 *
 * Платёж: прямой SPL transferChecked USDC (любая сумма) → ATA казначея с memo(betRef).
 * Никаких агрегаторов — строим транзакцию через @solana/web3.js, который
 * подгружается ДИНАМИЧЕСКИ только в момент ставки (лента остаётся лёгкой).
 * Верификация на сервере — один JSON-RPC getTransaction (cryo/verify.ts).
 */

export interface CryoWallet {
  /** адрес позиции (Solana base58 / demo:guest-…) */
  address: string;
  provider: "phantom" | "demo";
}

const GUEST_KEY = "nr-cryo-wallet";

interface SolanaPhantom {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: { toString(): string };
  }>;
  signMessage?(msg: Uint8Array, enc?: string): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?(tx: unknown): Promise<{ signature: string }>;
}

export function phantomProvider(): SolanaPhantom | null {
  if (typeof window === "undefined") return null;
  const p = (window as unknown as { phantom?: { solana?: SolanaPhantom } })
    .phantom;
  return p?.solana?.isPhantom ? p.solana : null;
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

/* ---------------- сессия Phantom на сайте ---------------- */

/** Сессия сайта: cookie nr_phantom (авторизация task 42) */
export async function fetchPhantomSession(): Promise<string | null> {
  try {
    const r = await fetch("/api/auth/phantom", { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { wallet?: string | null };
    return d.wallet ?? null;
  } catch {
    return null;
  }
}

/**
 * Полная авторизация через Phantom: connect → signMessage → POST /api/auth/phantom.
 * Бросает Error с человекочитаемым текстом — показывает WalletButton.
 */
export async function signInWithPhantom(): Promise<string> {
  const ph = phantomProvider();
  if (!ph) {
    throw new Error("Phantom not found — install phantom.app to sign in");
  }
  const res = await ph.connect();
  const address = res?.publicKey?.toString();
  if (!address) throw new Error("No Phantom account");

  const message = `no reality. sign in\nwallet: ${address}\ntime: ${new Date().toISOString()}`;
  if (!ph.signMessage) throw new Error("Phantom signMessage unavailable");
  const signed = await ph.signMessage(new TextEncoder().encode(message), "utf8");

  const { default: bs58 } = await import("bs58");
  // task 44: код пригласившего (если гость пришёл по ?ref=) —
  // сервер начисляет welcome-бонус обеим сторонам при первом входе
  let invitedBy: string | null = null;
  try {
    const { myShareRef } = await import("@/lib/shareRef");
    invitedBy = myShareRef();
  } catch {
    /* атрибуция не критична */
  }
  const r = await fetch("/api/auth/phantom", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      wallet: address,
      message,
      signature: bs58.encode(signed.signature),
      invitedBy,
    }),
  });
  const d = (await r.json()) as { wallet?: string; error?: string };
  if (!r.ok || !d.wallet) throw new Error(d.error || "Sign-in failed");
  return d.wallet;
}

export async function signOutPhantom(): Promise<void> {
  try {
    await fetch("/api/auth/phantom", { method: "DELETE" });
  } catch {
    /* best-effort */
  }
}

/* ---------------- identity для предиктов ---------------- */

/**
 * Кошелёк позиции: сессия сайта → Phantom one-tap → demo-гость.
 * (MetaMask в предиктах не участвует: USDC — только Solana.)
 */
export async function ensureCryoWallet(): Promise<CryoWallet> {
  const session = await fetchPhantomSession();
  if (session) return { address: session, provider: "phantom" };

  const ph = phantomProvider();
  if (ph) {
    try {
      const addr = await signInWithPhantom();
      return { address: addr, provider: "phantom" };
    } catch {
      /* отклонено — падаем в demo */
    }
  }
  return guestWallet();
}

/**
 * Read-only identity для поллинга рынков (НИКАКИХ поп-апов):
 * сессия Phantom-cookie, иначе гостевой адрес из localStorage (если уже
 * создавался). Новых гостей не создаём — identity фиксируется при ставке.
 */
export async function peekCryoWallet(): Promise<string | null> {
  const session = await fetchPhantomSession();
  if (session) return session;
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(GUEST_KEY);
    if (saved && /^demo:guest-[a-z0-9]{10}$/.test(saved)) return saved;
  } catch {
    /* приватный режим */
  }
  return null;
}

/* ---------------- платёж: прямой перевод USDC ---------------- */

export interface PayUsdcResult {
  mode: "phantom" | "demo";
  txSig: string | null;
  error?: string;
}

/**
 * Оплата ставки USDC (упрощение task 42/43, любая сумма):
 *  - usdc-канал (казначей задан) → SPL transferChecked + memo(betRef)
 *    через Phantom, динамический import @solana/web3.js;
 *  - demo — protected-симуляция (тот же UX, позиция в реестре).
 */
export async function payUsdc(args: {
  exchange: "demo" | "usdc";
  usdcMint: string;
  treasury: string;
  amountUsdc: string;
  betRef: string;
}): Promise<PayUsdcResult> {
  const ph = phantomProvider();

  if (args.exchange === "usdc" && ph?.signAndSendTransaction && args.treasury) {
    try {
      // Buffer-полифилл ДО import web3.js (Turbopack не шарит node-polyfill'ы)
      if (typeof (globalThis as { Buffer?: unknown }).Buffer === "undefined") {
        const { Buffer } = await import("buffer");
        (globalThis as { Buffer?: unknown }).Buffer = Buffer;
      }
      const web3 = await import("@solana/web3.js");
      type SolanaWeb3 = typeof web3;

      const { publicKey } = await ph.connect();
      const owner = new web3.PublicKey(publicKey.toString());
      const mint = new web3.PublicKey(args.usdcMint);
      const treasury = new web3.PublicKey(args.treasury);

      const conn = new web3.Connection(
        (process.env.NEXT_PUBLIC_PREDICT_RPC_URL as string) ||
          "https://api.mainnet-beta.solana.com",
        "confirmed"
      );

      // ATA-деривация по seeds (без @solana/spl-token)
      const TOKEN_PROGRAM = new web3.PublicKey(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
      );
      const ATA_PROGRAM = new web3.PublicKey(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
      );
      const ataOf = (o: InstanceType<SolanaWeb3["PublicKey"]>) =>
        web3.PublicKey.findProgramAddressSync(
          [o.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()],
          ATA_PROGRAM
        )[0];
      const source = ataOf(owner);
      const destination = ataOf(treasury);

      const tx = new web3.Transaction({ feePayer: owner });

      // memo(betRef) — анти-реплей метка, по ней сервер сверяет транзакцию
      tx.add(
        new web3.TransactionInstruction({
          keys: [],
          programId: new web3.PublicKey(
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" // SPL Memo
          ),
          data: Buffer.from(args.betRef, "utf8"),
        })
      );

      // если у плательщика ещё нет USDC-ATA — добавим его создание (layout Create)
      const srcInfo = await conn.getAccountInfo(source).catch(() => null);
      if (!srcInfo) {
        tx.add(
          new web3.TransactionInstruction({
            programId: ATA_PROGRAM,
            keys: [
              { pubkey: owner, isSigner: true, isWritable: true }, // payer
              { pubkey: source, isSigner: false, isWritable: true }, // ata
              { pubkey: owner, isSigner: false, isWritable: false }, // owner
              { pubkey: mint, isSigner: false, isWritable: false },
              { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
              { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
              { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([0]), // Create
          })
        );
      }

      // SPL Token: TransferChecked (tag 12) — u64 amount + u8 decimals
      const amount = BigInt(Math.round(parseFloat(args.amountUsdc) * 1_000_000));
      const data = Buffer.alloc(1 + 8 + 1);
      data.writeUInt8(12, 0);
      data.writeBigUInt64LE(amount, 1);
      data.writeUInt8(6, 9); // USDC decimals
      tx.add(
        new web3.TransactionInstruction({
          programId: TOKEN_PROGRAM,
          keys: [
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: true, isWritable: false },
          ],
          data,
        })
      );

      const { blockhash, lastValidBlockHeight } =
        await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;

      const signed = await ph.signAndSendTransaction(tx);
      return { mode: "phantom", txSig: signed.signature };
    } catch (e) {
      // пользователь отклонил / сеть упала — позиция НЕ фиксируется
      return {
        mode: "phantom",
        txSig: null,
        error: e instanceof Error ? e.message : "payment failed",
      };
    }
  }

  // demo: поп-ап рисует CryoStopCard (ProtectedOverlay), задержка имитирует сеть
  await new Promise((r) => setTimeout(r, 1400));
  return { mode: "demo", txSig: null };
}
