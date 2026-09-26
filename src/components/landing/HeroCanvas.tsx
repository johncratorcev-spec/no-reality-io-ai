"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Hero-шейдер: кровавый дым по ночному фону. Domain-warped fbm      */
/*  (та же «шёлковая» турбулентность, что была раньше) перекрашена    */
/*  в палитру карнавала: ночь #08070B, вино #4A0E1C, кровь #FF003C    */
/*  с редкими золотыми прожилками. Дым дышит вслед за курсором.       */
/*  Лёгкий: 30fps cap, DPR ≤ 1.5, пауза при скрытой вкладке,          */
/*  CSS-fallback без WebGL.                                           */
/* ------------------------------------------------------------------ */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

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
  vec2 p = uv - 0.5;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.05;

  /* органика: двойное доменное искажение — «дымная» турбулентность */
  vec2 q = vec2(
    fbm(p * 1.35 + vec2(0.0, t)),
    fbm(p * 1.35 + vec2(5.2, -t * 0.8))
  );
  vec2 r = vec2(
    fbm(p * 1.75 + 2.6 * q + vec2(1.7, 9.2) + t * 0.5),
    fbm(p * 1.75 + 2.6 * q + vec2(8.3, 2.8) - t * 0.35)
  );
  float f = fbm(p * 2.1 + 2.2 * r);

  /* курсор мягко «притягивает» дым */
  float md = exp(-3.5 * length(p - u_mouse * 0.55));
  f += md * 0.09;

  /* палитра: ночь + вино + кровь + золотая пыль */
  vec3 night  = vec3(0.031, 0.027, 0.043);
  vec3 cellar = vec3(0.075, 0.031, 0.055);
  vec3 wine   = vec3(0.290, 0.055, 0.110);
  vec3 blood  = vec3(1.000, 0.000, 0.235);
  vec3 rust   = vec3(0.640, 0.000, 0.150);
  vec3 gold   = vec3(0.850, 0.640, 0.255);

  vec3 c = night;
  c = mix(c, cellar, smoothstep(0.20, 0.75, q.x) * 0.85);
  c = mix(c, wine,   smoothstep(0.30, 0.85, r.x) * 0.60);
  c = mix(c, rust,   smoothstep(0.52, 0.94, f) * 0.42);

  /* кровавые прожилки: узкие гребни шума */
  float vein = smoothstep(0.46, 0.53, r.y) * (1.0 - smoothstep(0.53, 0.66, r.y));
  c = mix(c, blood, vein * (0.30 + 0.22 * md));

  /* золотая пыль: ещё более узкий гребень */
  float dust = smoothstep(0.58, 0.62, q.y) * (1.0 - smoothstep(0.62, 0.70, q.y));
  c = mix(c, gold, dust * 0.16);

  /* красное свечение за заголовком */
  c += vec3(0.55, 0.0, 0.14) * exp(-3.2 * length(p)) * 0.34;

  /* виньетка */
  c *= mix(1.0, 0.78, abs(uv.y - 0.5) * 0.9);
  c *= mix(1.0, 0.85, abs(p.x) * 0.7);

  /* зерно */
  c += (hash(uv * u_res.xy + fract(u_time)) - 0.5) * 0.022;

  gl_FragColor = vec4(c, 1.0);
}
`;

const FRAME_MIN_MS = 1000 / 30; // 30fps — дым медленный, батарея целая

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // reduced-motion: шейдер не запускаем вовсе — статичный градиент-фолбэк
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFailed(true);
      return;
    }

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
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    /* курсор: цель + плавный lerp — дым «дышит» вслед за мышью */
    const mouse = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = 1 - ((e.clientY - r.top) / r.height) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let raf = 0;
    let lastFrame = 0;
    const t0 = performance.now();
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (now - lastFrame < FRAME_MIN_MS) return;
      lastFrame = now;

      mouse.x += (target.x - mouse.x) * 0.04;
      mouse.y += (target.y - mouse.y) * 0.04;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
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
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  if (failed) {
    /* CSS-fallback: ночь + кровавые пятна дыма */
    return (
      <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#08070B]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 70% at 50% -10%, rgba(163,0,38,0.30) 0%, rgba(8,7,11,0) 55%), radial-gradient(70% 55% at 12% 100%, rgba(74,14,28,0.5) 0%, rgba(8,7,11,0) 60%), #08070B",
          }}
        />
        <div className="nrld-blob absolute -left-24 top-1/4 h-[26rem] w-[26rem] rounded-full bg-[#A30026]/35 blur-3xl" />
        <div className="nrld-blob nrld-blob-2 absolute -right-20 top-1/2 h-[22rem] w-[22rem] rounded-full bg-[#4A0E1C]/50 blur-3xl" />
        <div className="nrld-blob absolute left-1/3 bottom-[8%] h-[18rem] w-[18rem] rounded-full bg-[#FF003C]/12 blur-3xl" />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  );
}
