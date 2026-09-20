/** Смоук авторизации Phantom: подпись ed25519 → cookie сессии. */
import nacl from "tweetnacl";
import bs58 from "bs58";

const BASE = "http://localhost:3111";

const kp = nacl.sign.keyPair();
const wallet = bs58.encode(kp.publicKey);
const message = `no reality. sign in\nwallet: ${wallet}\ntime: ${new Date().toISOString()}`;
const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));

const r1 = await fetch(`${BASE}/api/auth/phantom`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ wallet, message, signature: sig }),
});
const cookie = r1.headers.get("set-cookie")?.split(";")[0] ?? "";
const d1 = await r1.json();
console.log("valid sig:", r1.status, JSON.stringify(d1), "cookie:", cookie.startsWith("nr_phantom="));

// GET с cookie → сессия
const r2 = await fetch(`${BASE}/api/auth/phantom`, { headers: { cookie } });
const d2 = await r2.json();
console.log("session GET:", r2.status, JSON.stringify(d2), "ok:", d2.wallet === wallet && d2.provider === "phantom");

// битая подпись → 400
const r3 = await fetch(`${BASE}/api/auth/phantom`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ wallet, message, signature: sig.slice(0, -4) + "AAAA" }),
});
console.log("bad sig:", r3.status, "(expect 400)");

// устаревшее сообщение (−11 минут) → 400
const oldMsg = `no reality. sign in\nwallet: ${wallet}\ntime: ${new Date(Date.now() - 11 * 60000).toISOString()}`;
const oldSig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(oldMsg), kp.secretKey));
const r4 = await fetch(`${BASE}/api/auth/phantom`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ wallet, message: oldMsg, signature: oldSig }),
});
console.log("stale msg:", r4.status, "(expect 400)");

// DELETE → выход
const r5 = await fetch(`${BASE}/api/auth/phantom`, { method: "DELETE", headers: { cookie } });
console.log("logout:", r5.status);
