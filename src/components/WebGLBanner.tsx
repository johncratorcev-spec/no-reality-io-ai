"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";

export const VIRAL_URL = "https://t.me/smartluvon_bot?start=ref_PCQ8ECMN";

/* ------------------------------------------------------------------ */
/*  WebGL-шейдер: шёлковые волны в усиленной палитре                   */
/*  (violet → fuchsia → pink → amber + блик teal, зерно, свет-свип)    */
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

  float t = u_time * 0.055;

  float w1 = fbm(vec2(p.x * 1.6 - t * 1.5,       p.y * 2.2 + t));
  float w2 = fbm(vec2(p.x * 2.4 + t * 1.2 + 5.2, p.y * 1.4 - t * 0.8));
  float w3 = fbm(vec2(p.x * 1.1 - t * 0.6 + 9.1, p.y * 3.1 + t * 1.7));

  vec3 c = vec3(0.996, 0.988, 0.995);

  vec3 violet  = vec3(0.486, 0.227, 0.929);
  vec3 fuchsia = vec3(0.851, 0.275, 0.937);
  vec3 pink    = vec3(0.925, 0.282, 0.600);
  vec3 amber   = vec3(0.961, 0.620, 0.043);
  vec3 teal    = vec3(0.051, 0.580, 0.533);

  c = mix(c, violet,  smoothstep(0.30, 0.90, w1) * 0.58);
  c = mix(c, fuchsia, smoothstep(0.38, 0.95, w2) * 0.52);
  c = mix(c, pink,    smoothstep(0.45, 1.00, w3) * 0.46);
  c = mix(c, amber,   smoothstep(0.58, 1.00, w2 * w3) * 0.50);
  c = mix(c, teal,    smoothstep(0.72, 1.00, w1 * w3) * 0.26);

  float d = fract((uv.x + uv.y) * 0.55 - u_time * 0.045);
  float sweep = smoothstep(0.0, 0.22, d) * smoothstep(0.55, 0.30, d);
  c += sweep * 0.10;

  c *= mix(1.0, 0.93, abs(uv.y - 0.5) * 0.7);

  c += (hash(uv * u_res.xy + fract(u_time)) - 0.5) * 0.03;

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
      aria-label="Баннер: место ожидает владельца"
    >
      {/* WebGL-полотно / CSS-fallback */}
      {failed ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, #ede9fe 0%, #fae8ff 25%, #fce7f3 50%, #fef3c7 78%, #ccfbf1 100%)",
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
        />
      )}

      {/* мягкая вуаль для читаемости */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 160% at 50% 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.35) 100%)",
        }}
      />

      {/* контент баннера */}
      <div className="relative mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-5">
        <motion.div
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="nr-glass-deep flex shrink-0 items-center rounded-full px-3 py-1.5 sm:px-5 sm:py-2"
        >
          <span className="text-[0.72rem] font-semibold tracking-tight text-[#1b1523] sm:text-[0.95rem]">
            место ожидает владельца
          </span>
          <span
            aria-hidden
            className="ml-3 hidden h-1.5 w-1.5 rounded-full bg-[#f59e0b] sm:block"
            style={{ boxShadow: "0 0 10px 2px rgba(245,158,11,.7)" }}
          />
        </motion.div>

        <motion.a
          href={VIRAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Стать владельцем места — @smartluvon_bot в Telegram"
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.045, y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.9, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="nr-btn-glow group flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-white sm:gap-2 sm:px-5 sm:py-2"
          style={{
            background: "var(--nr-grad)",
          }}
        >
          <Send className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          <span className="text-[0.7rem] font-bold tracking-tight sm:text-[0.8rem]">
            владеть<span className="hidden sm:inline"> местом</span>
          </span>
          <span className="hidden text-[0.72rem] font-medium text-white/85 md:inline sm:text-[0.8rem]">
            @smartluvon_bot
          </span>
        </motion.a>
      </div>
    </motion.section>
  );
}
