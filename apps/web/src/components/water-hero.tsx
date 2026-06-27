// @ts-nocheck
"use client";

import { useEffect, useRef, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────── */

interface WaterState {
  cur:  Float32Array;
  prev: Float32Array;
  vel:  Float32Array;
  next: Float32Array; // pre-allocated swap buffer — no GC pressure
  cols: number;
  rows: number;
  W:    number;
  H:    number;
  lastX: number;
  lastY: number;
  clickTimer: ReturnType<typeof setTimeout> | null;
}

interface TrailPoint {
  x:     number;
  y:     number;
  speed: number;
}

/* ─── Constants ──────────────────────────────────────────── */

const DAMP      = 0.96;
const TRAIL_LEN = 18;

/* ─── Pure helpers (outside component — stable references) ── */

function idx(c: number, r: number, cols: number): number {
  return r * cols + c;
}

// noUncheckedIndexedAccess safe helpers
function get(arr: Float32Array, i: number): number {
  return arr[i] ?? 0;
}
function add(arr: Float32Array, i: number, v: number): void {
  arr[i] = (arr[i] ?? 0) + v;
}
function set(arr: Float32Array, i: number, v: number): void {
  arr[i] = v;
}

function disturbState(
  s: WaterState,
  px: number,
  py: number,
  strength: number,
  radius: number,
): void {
  const gc = Math.floor((px / s.W) * s.cols);
  const gr = Math.floor((py / s.H) * s.rows);
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nc = gc + dc;
      const nr = gr + dr;
      if (nc < 1 || nc >= s.cols - 1 || nr < 1 || nr >= s.rows - 1) continue;
      const d = Math.sqrt(dc * dc + dr * dr);
      if (d <= radius) {
        const t = d / radius;
        add(s.cur, idx(nc, nr, s.cols), strength * Math.exp(-t * t * 3));
      }
    }
  }
}

function dropState(
  s: WaterState,
  px: number,
  py: number,
  strength: number,
  radius: number,
): void {
  const gc = Math.floor((px / s.W) * s.cols);
  const gr = Math.floor((py / s.H) * s.rows);
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nc = gc + dc;
      const nr = gr + dr;
      if (nc < 1 || nc >= s.cols - 1 || nr < 1 || nr >= s.rows - 1) continue;
      const d = Math.sqrt(dc * dc + dr * dr);
      if (d <= radius) {
        const t      = d / radius;
        const impact = strength * Math.exp(-t * t * 5);
        s.cur[idx(nc, nr, s.cols)] += impact;
        s.vel[idx(nc, nr, s.cols)] += impact * 0.5;
      }
    }
  }
}

function ringDropState(
  s: WaterState,
  px: number,
  py: number,
  ringRadius: number,
  strength: number,
  thickness: number,
): void {
  const gc    = Math.floor((px / s.W) * s.cols);
  const gr    = Math.floor((py / s.H) * s.rows);
  const outer = ringRadius + thickness;
  for (let dr = -outer; dr <= outer; dr++) {
    for (let dc = -outer; dc <= outer; dc++) {
      const nc = gc + dc;
      const nr = gr + dr;
      if (nc < 1 || nc >= s.cols - 1 || nr < 1 || nr >= s.rows - 1) continue;
      const d = Math.sqrt(dc * dc + dr * dr);
      if (d >= ringRadius - thickness && d <= ringRadius + thickness) {
        const t      = (d - ringRadius) / thickness;
        const impact = strength * Math.exp(-t * t * 2.5);
        s.cur[idx(nc, nr, s.cols)] += impact;
        s.vel[idx(nc, nr, s.cols)] += impact * 0.6;
      }
    }
  }
}

function stepState(s: WaterState): void {
  for (let r = 1; r < s.rows - 1; r++) {
    for (let c = 1; c < s.cols - 1; c++) {
      const i = idx(c, r, s.cols);
      const laplacian =
        s.cur[idx(c - 1, r, s.cols)] +
        s.cur[idx(c + 1, r, s.cols)] +
        s.cur[idx(c, r - 1, s.cols)] +
        s.cur[idx(c, r + 1, s.cols)] -
        4 * s.cur[i];
      s.vel[i]  = (s.vel[i] + laplacian * 0.5) * DAMP;
      s.next[i] = s.cur[i] + s.vel[i];
    }
  }
  // Swap buffers — no allocation
  const tmp = s.prev;
  s.prev    = s.cur;
  s.cur     = s.next;
  s.next    = tmp;
}

function drawState(s: WaterState, ctx: CanvasRenderingContext2D): void {
  const imgData = ctx.createImageData(s.W, s.H);
  const d       = imgData.data;

  for (let y = 0; y < s.H; y++) {
    for (let x = 0; x < s.W; x++) {
      const gc  = Math.min(s.cols - 2, Math.floor((x / s.W) * s.cols));
      const gr  = Math.min(s.rows - 2, Math.floor((y / s.H) * s.rows));
      const v   = get(s.cur, idx(gc, gr, s.cols));
      const gcR = Math.min(s.cols - 2, gc + 1);
      const grD = Math.min(s.rows - 2, gr + 1);
      const gcL = Math.max(1, gc - 1);
      const grU = Math.max(1, gr - 1);
      const dx  = get(s.cur, idx(gcR, gr, s.cols)) - get(s.cur, idx(gcL, gr, s.cols));
      const dy  = get(s.cur, idx(gc, grD, s.cols)) - get(s.cur, idx(gc, grU, s.cols));

      const light = Math.max(0, (dx + dy) * 0.038);
      const depth = Math.max(0, Math.min(1, Math.abs(v) / 12));

      let R = 13, G = 40, B = 48;
      R += depth * 6  + light * 36;
      G += depth * 20 + light * 88;
      B += depth * 16 + light * 68;

      const pi = (y * s.W + x) * 4;
      set(d as unknown as Float32Array, pi,     Math.min(255, R));
      set(d as unknown as Float32Array, pi + 1, Math.min(255, G));
      set(d as unknown as Float32Array, pi + 2, Math.min(255, B));
      set(d as unknown as Float32Array, pi + 3, 255);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/* ─── Component ──────────────────────────────────────────── */

export function WaterHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef   = useRef<HTMLDivElement>(null);
  const stateRef  = useRef<WaterState | null>(null);
  const animRef   = useRef<number>(0);
  const activeRef = useRef<boolean>(true);
  const trailRef  = useRef<TrailPoint[]>([]);

  /* Resize — creates fresh WaterState */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const hero   = heroRef.current;
    if (!canvas || !hero) return;
    const W    = (canvas.width  = hero.offsetWidth);
    const H    = (canvas.height = hero.offsetHeight);
    const cols = Math.floor(W / 4); // W/4 grid — 4× fewer cells than W/2
    const rows = Math.floor(H / 4);
    const n    = cols * rows;
    stateRef.current = {
      cur:  new Float32Array(n),
      prev: new Float32Array(n),
      vel:  new Float32Array(n),
      next: new Float32Array(n),
      cols, rows, W, H,
      lastX: -1, lastY: -1,
      clickTimer: null,
    };
  }, []);

  /* Main loop */
  const loop = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (s && canvas && activeRef.current) {
      // Apply wake trail
      const trail = trailRef.current;
      if (trail.length >= 2) {
        for (let i = 0; i < trail.length; i++) {
          const p      = trail[i];
          const age    = i / (trail.length - 1);
          const radius = Math.floor(4 + age * 18);
          const str    = (1 - age * 0.6) * p.speed * 0.18;
          if (str > 0.1) disturbState(s, p.x, p.y, Math.min(str, 4.5), radius);
        }
      }
      stepState(s);
      const ctx = canvas.getContext("2d");
      if (ctx) drawState(s, ctx);
    }
    animRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    resize();

    const hero = heroRef.current;
    if (!hero) return;

    /* Pause when tab hidden */
    const onVisibility = () => {
      activeRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    /* Pause when hero scrolled off screen */
    const observer = new IntersectionObserver(
      ([entry]) => { activeRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(hero);

    /* Mouse handlers */
    const onMouseMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const rect = hero.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      if (s.lastX >= 0) {
        const vx    = mx - s.lastX;
        const vy    = my - s.lastY;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0.5) {
          trailRef.current.unshift({ x: mx, y: my, speed });
          if (trailRef.current.length > TRAIL_LEN) trailRef.current.pop();
        }
      }
      s.lastX = mx;
      s.lastY = my;
    };

    const onMouseLeave = () => {
      const s = stateRef.current;
      if (!s) return;
      s.lastX = -1;
      s.lastY = -1;
      trailRef.current = [];
    };

    const onClick = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const rect = hero.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const y    = e.clientY - rect.top;
      s.clickTimer = setTimeout(() => {
        const st = stateRef.current;
        if (st) dropState(st, x, y, 10, 18);
      }, 200);
    };

    const onDblClick = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s) return;
      if (s.clickTimer) clearTimeout(s.clickTimer);
      const rect = hero.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const y    = e.clientY - rect.top;
      // Big drop — centre impact + 3 staggered rings
      dropState(s, x, y, 16, 10);
      setTimeout(() => { const st = stateRef.current; if (st) ringDropState(st, x, y, 6, 14, 3); },   120);
      setTimeout(() => { const st = stateRef.current; if (st) ringDropState(st, x, y, 4, 10, 2.5); }, 280);
      setTimeout(() => { const st = stateRef.current; if (st) ringDropState(st, x, y, 3, 7, 2); },    460);
    };

    const onResize = () => resize();

    hero.addEventListener("mousemove",  onMouseMove);
    hero.addEventListener("mouseleave", onMouseLeave);
    hero.addEventListener("click",      onClick);
    hero.addEventListener("dblclick",   onDblClick);
    window.addEventListener("resize",   onResize);

    animRef.current = requestAnimationFrame(loop);

    return () => {
      hero.removeEventListener("mousemove",  onMouseMove);
      hero.removeEventListener("mouseleave", onMouseLeave);
      hero.removeEventListener("click",      onClick);
      hero.removeEventListener("dblclick",   onDblClick);
      window.removeEventListener("resize",   onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      cancelAnimationFrame(animRef.current);
    };
  }, [resize, loop]);

  /* ─── Render ───────────────────────────────────────────── */

  return (
    <section
      ref={heroRef}
      aria-label="Victoria Yap — Head of SEO | Organic Growth"
      style={{
        position: "relative",
        width: "100%",
        height: "80vh",
        minHeight: "560px",
        overflow: "hidden",
        cursor: "crosshair",
        background: "#0d2830",
      }}
    >
      {/* Water canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* Outer flex — centres the grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {/* Grid — exactly 2 direct children: left col + right col */}
        <div className="hero-grid">

          {/* ── LEFT COLUMN ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            {/* Greetings */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "2px",
                marginBottom: "18px",
              }}
            >
              <span
                lang="ja"
                style={{
                  fontFamily: "Georgia,serif",
                  fontSize: "clamp(22px,3.5vw,40px)",
                  color: "rgba(240,237,232,0.35)",
                  lineHeight: 1.1,
                  textShadow: "0 1px 24px rgba(0,0,0,0.8)",
                }}
              >
                初めまして、
              </span>
              <span
                lang="en"
                style={{
                  fontFamily: "Georgia,serif",
                  fontSize: "clamp(28px,4.5vw,52px)",
                  color: "rgba(240,237,232,0.55)",
                  lineHeight: 1.1,
                  textShadow: "0 1px 24px rgba(0,0,0,0.8)",
                }}
              >
                Hello,
              </span>
              <span
                lang="zh"
                style={{
                  fontFamily: "Georgia,serif",
                  fontSize: "clamp(30px,5vw,58px)",
                  color: "rgba(240,237,232,0.75)",
                  lineHeight: 1.1,
                  textShadow: "0 1px 24px rgba(0,0,0,0.8)",
                }}
              >
                你好
              </span>
              <span
                lang="en"
                style={{
                  fontFamily: "Georgia,serif",
                  fontSize: "clamp(34px,5.5vw,64px)",
                  color: "rgba(240,237,232,0.95)",
                  lineHeight: 1.1,
                  textShadow: "0 1px 24px rgba(0,0,0,0.8)",
                  whiteSpace: "nowrap",
                }}
              >
                I&apos;m Victoria Yap
              </span>
            </div>

            {/* Divider */}
            <div
              aria-hidden="true"
              style={{
                width: "36px",
                height: "1px",
                background: "rgba(93,202,165,0.3)",
                marginBottom: "14px",
              }}
            />

            {/* Tagline */}
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "clamp(10px,1.2vw,12px)",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(93,202,165,0.5)",
                marginBottom: "32px",
              }}
            >
              Head of SEO | Organic Growth
            </p>

            {/* Buttons */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                pointerEvents: "all",
              }}
            >
              <a
                href="/case-studies"
                style={{
                  fontFamily: "monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  color: "#fff",
                  background: "rgba(31,77,92,0.8)",
                  border: "1px solid rgba(93,202,165,0.3)",
                  padding: "12px 24px",
                  borderRadius: "10px",
                }}
              >
                View Case Studies
              </a>
              <a
                href="/contact"
                style={{
                  fontFamily: "monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  color: "rgba(240,237,232,0.7)",
                  background: "transparent",
                  border: "1px solid rgba(240,237,232,0.2)",
                  padding: "12px 24px",
                  borderRadius: "10px",
                }}
              >
                Get In Touch
              </a>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="hero-photo-col">
            <svg
              style={{ position: "absolute", width: 0, height: 0 }}
              aria-hidden="true"
            >
              <defs>
                <clipPath id="blobClip" clipPathUnits="objectBoundingBox"
                  transform="scale(0.005 0.005)">
                  <path d="M41,-73.4C52,-64.8,58.9,-51.4,63.9,-38.4C68.8,-25.3,71.7,-12.7,73.6,1.1C75.5,14.9,76.4,29.8,72,43.7C67.6,57.6,57.9,70.5,45,79.4C32.1,88.3,16.1,93.2,1.4,90.8C-13.3,88.4,-26.6,78.8,-40.7,70.6C-54.8,62.4,-69.7,55.6,-77.5,44.1C-85.3,32.6,-86,16.3,-82.7,1.9C-79.4,-12.5,-72.1,-24.9,-63.4,-35C-54.8,-45.1,-44.9,-52.9,-34.1,-61.6C-23.3,-70.3,-11.7,-82,1.7,-82.9C15,-85.8,30.1,-82,41,-73.4Z" transform="translate(100 100)" />
                </clipPath>
              </defs>
            </svg>
            <div className="hero-blob">
              <img
                src="https://cdn.sanity.io/images/o5gqs16l/production/b56fa625c57716afb31b83820bb54acae0b3a901-459x711.webp?fit=max&w=1200&h=1200"
                alt="Victoria Yap, Head of SEO and Organic Growth"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Responsive styles — inline style prop can't do media queries */}
      <style>{`
        .hero-grid {
          display: grid;
          grid-template-columns: 55% 45%;
          gap: 48px;
          align-items: center;
          width: 100%;
          max-width: 960px;
          padding: 0 40px;
        }
        .hero-photo-col {
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .hero-blob {
          width: 420px;
          height: 520px;
          clip-path: url(#blobClip);
          overflow: hidden;
        }
        @media (max-width: 767px) {
.hero-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto;
            gap: 20px;
            padding: 48px 24px 64px;
            align-items: center;
          }
          .hero-photo-col {
            order: -1;
          }
          .hero-blob {
            width: 220px;
            height: 275px;
          }
        }
      `}</style>

    </section>
  );
}
