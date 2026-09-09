"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export const VIRAL_URL = "https://t.me/smartluvon_bot?start=ref_PCQ8ECMN";

/* ------------------------------------------------------------------ */
/*  WebGL-шейдер: перламутрово-голубые шёлковые волны                  */
/*  (лёд + жемчуг + лёгкая радужная иридисценция + блик-шимер)         */
/* ------------------------------------------------------------------ */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.05;

  float w1 = fbm(vec2(p.x * 1.5 - t * 1.4,       p.y * 2.1 + t));
  float w2 = fbm(vec2(p.x * 2.3 + t * 1.1 + 5.2, p.y * 1.3 - t * 0.8));
  float w3 = fbm(vec2(p.x * 1.0 - t * 0.5 + 9.1, p.y * 2.9 + t * 1.6));

  /* база — почти белый лёд */
  vec3 c = vec3(0.975, 0.988, 0.998);

  vec3 deepBlue = vec3(0.240, 0.490, 0.722);  /* #3d7db8 */
  vec3 blue     = vec3(0.357, 0.608, 0.835);  /* #5b9bd5 */
  vec3 ice      = vec3(0.659, 0.812, 0.918);  /* #a8cfea */
  vec3 pearl    = vec3(0.863, 0.922, 0.969);  /* #dcebf7 */
  vec3 iridPink = vec3(0.902, 0.867, 0.925);  /* перламутровый розоватый отлив */
  vec3 iridMint = vec3(0.824, 0.914, 0.906);  /* перламутровый мятный отлив */

  c = mix(c, pearl,    smoothstep(0.25, 0.85, w1) * 0.75);
  c = mix(c, ice,      smoothstep(0.35, 0.92, w2) * 0.62);
  c = mix(c, blue,     smoothstep(0.52, 0.98, w3) * 0.42);
  c = mix(c, deepBlue, smoothstep(0.68, 1.00, w1 * w2) * 0.30);

  /* тонкая иридисценция — перламутровые отливы на границах волн */
  float edge = smoothstep(0.42, 0.50, w2) * (1.0 - smoothstep(0.50, 0.58, w2));
  c = mix(c, iridPink, edge * 0.55);
  float edge2 = smoothstep(0.46, 0.55, w3) * (1.0 - smoothstep(0.55, 0.64, w3));
  c = mix(c, iridMint, edge2 * 0.45);

  /* перламутровый шиммер — бегущий блик */
  float shimmer = pow(max(0.0, sin((uv.x * 2.2 + uv.y * 3.1) * 3.14159 + u_time * 0.35 + w1 * 2.0)), 6.0);
  c += shimmer * 0.10;

  /* мягкий диагональный свет */
  float d = fract((uv.x + uv.y) * 0.5 - u_time * 0.04);
  float sweep = smoothstep(0.0, 0.25, d) * smoothstep(0.6, 0.32, d);
  c += sweep * 0.07;

  /* воздушная виньетка */
  c *= mix(1.0, 0.94, abs(uv.y - 0.5) * 0.7);

  /* тонкое зерно */
  c += (hash(uv * u_res.xy + fract(u_time)) - 0.5) * 0.025;

  gl_FragColor = vec4(c, 1.0);
}
`;

function useWebGLCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      setFailed(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const t0 = performance.now();
    const render = () => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return { canvasRef, failed };
}

/* ------------------------------------------------------------------ */

export default function WebGLBanner() {
  const { canvasRef, failed } = useWebGLCanvas();

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 h-[var(--nr-banner-h)] shrink-0 overflow-hidden"
      aria-label="Баннер: smartluvon — Partner of Week"
    >
      {/* WebGL-полотно / CSS-fallback */}
      {failed ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, #e2eff8 0%, #c3ddf0 30%, #dcebf7 55%, #b3d4ec 80%, #e8f2fa 100%)",
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
        />
      )}

      {/* мягкая воздушная вуаль для читаемости центра */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 140% at 50% 50%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* весь баннер — вирусная ссылка */}
      <motion.a
        href={VIRAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="smartluvon — Partner of Week. Перейти в Telegram"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="group relative flex h-full w-full items-center justify-center"
      >
        <div className="flex flex-col items-center leading-none">
          <span className="text-[0.95rem] font-extrabold tracking-tight text-[#0a0a0a] sm:text-[1.15rem]">
            smartluvon
          </span>
          <span className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.28em] text-[#10161d]/60 sm:text-[0.65rem]">
            — Partner of Week —
          </span>
        </div>

        {/* мягкое ч/б свечение подписи при ховере */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          style={{ backdropFilter: "brightness(1.06)" }}
        />
      </motion.a>
    </motion.section>
  );
}
