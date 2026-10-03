#!/usr/bin/env node
/* Мок Google для v16 smoke (token + userinfo). */
import http from "node:http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "smoke-client-id";
const PORT = 9998;

http
  .createServer((req, res) => {
    const url = req.url || "";
    if (req.method === "POST" && url.includes("/token")) {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const params = new URLSearchParams(raw);
        const code = params.get("code") || "";
        const [, email, aud, verified] = code.split(":");
        if (aud !== CLIENT_ID) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_client" }));
          return;
        }
        console.log(`[mock] token ok: ${email} aud=${aud.slice(0, 8)}…`);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ access_token: `at:${email}:${verified}`, token_type: "Bearer", expires_in: 3600 }));
      });
      return;
    }
    if (req.method === "GET" && url.includes("/userinfo")) {
      /* oauth-библиотека может нести токен и в header, и в query — берём оба пути */
      let token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      try {
        if (token.includes("%")) token = decodeURIComponent(token);
      } catch {}
      if (!token.includes(":")) {
        const qp = new URL(url, "http://x").searchParams.get("access_token") || "";
        try { token = qp.includes("%") ? decodeURIComponent(qp) : qp; } catch { token = qp; }
      }
      const [, email, verified] = token.split(":");
      if (!email) {
        console.log(`[mock] userinfo BAD auth: ${req.headers.authorization}`);
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_token" }));
        return;
      }
      console.log(`[mock] userinfo: ${email} verified=${verified}`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          sub: `smoke-${Buffer.from(String(email)).toString("base64url").slice(0, 10)}`,
          email,
          email_verified: verified === "1",
          name: String(email).split("@")[0],
        })
      );
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("mock-google-ok");
  })
  .listen(PORT, "127.0.0.1", () => console.log(`[mock-google] on :${PORT}`));
