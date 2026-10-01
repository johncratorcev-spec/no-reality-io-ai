import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getPostByCode } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * v13 — OG-картинка раунда: /api/og/round/<code>?v=<verdict>
 * Дерзкая карточка 1200×630: REAL or SYNTH? + автор + бренд.
 * ?v=real|synth — режим результата (клиент шарит deep-link с исходом
 * после резолва). truth НЕ утекает: картинка сама вердикт не знает
 * и рисует v= только если вызвавшаяся сторона уже его знает.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const asParam = url.searchParams.get("v");
  const as = asParam === "real" || asParam === "synth" ? asParam : null;
  const isRu = url.searchParams.get("lang") === "ru";

  let author = "";
  try {
    const post = getPostByCode(code);
    author = post?.author ? `@${post.author.replace(/^@/, "")}` : "";
  } catch {
    /* без автора — ок */
  }

  const accent = as === "real" ? "#c8ff00" : as === "synth" ? "#ff003c" : "#f2ede4";
  const head = as
    ? isRu
      ? as === "real"
        ? "ЭТО БЫЛО ЖИВОЕ"
        : "ЭТО СИНТЕТИКА"
      : as === "real"
        ? "IT WAS REAL"
        : "IT WAS SYNTH"
    : "REAL or SYNTH?";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#08070b",
          color: "#f2ede4",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 14,
            background: as === "synth" ? "#ff003c" : "#c8ff00",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
          <div style={{ width: 54, height: 54, borderRadius: 999, background: "#c8ff00", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, background: "#08070b" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", color: "#f2ede4", display: "flex" }}>
            <span>no-reality</span>
            <span style={{ color: "#ff003c" }}>.</span>
          </div>
        </div>

        <div style={{ fontSize: as ? 92 : 104, fontWeight: 900, letterSpacing: "-0.03em", color: accent, textAlign: "center", lineHeight: 1 }}>
          {head}
        </div>

        <div style={{ marginTop: 34, fontSize: 30, fontWeight: 700, color: "rgba(242,237,228,.65)", display: "flex", gap: 14 }}>
          <span>{author}</span>
          <span style={{ color: "rgba(242,237,228,.3)" }}>·</span>
          <span>no-reality.fun</span>
        </div>

        <div
          style={{
            marginTop: 40,
            padding: "14px 42px",
            borderRadius: 999,
            background: "#c8ff00",
            color: "#08070b",
            fontSize: 32,
            fontWeight: 900,
          }}
        >
          {isRu ? "назови сам" : "call it yourself"}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 14,
            background: as === "synth" ? "#ff003c" : "#c8ff00",
            opacity: 0.5,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
