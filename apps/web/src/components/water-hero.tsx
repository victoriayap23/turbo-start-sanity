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
        s.cur[idx(nc, nr, s.cols)] += strength * Math.exp(-t * t * 3);
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
      const v   = s.cur[idx(gc, gr, s.cols)];
      const gcR = Math.min(s.cols - 2, gc + 1);
      const grD = Math.min(s.rows - 2, gr + 1);
      const gcL = Math.max(1, gc - 1);
      const grU = Math.max(1, gr - 1);
      const dx  = s.cur[idx(gcR, gr, s.cols)] - s.cur[idx(gcL, gr, s.cols)];
      const dy  = s.cur[idx(gc, grD, s.cols)] - s.cur[idx(gc, grU, s.cols)];

      const light = Math.max(0, (dx + dy) * 0.038);
      const depth = Math.max(0, Math.min(1, Math.abs(v) / 12));

      let R = 13, G = 40, B = 48;
      R += depth * 6  + light * 36;
      G += depth * 20 + light * 88;
      B += depth * 16 + light * 68;

      const pi = (y * s.W + x) * 4;
      d[pi]     = Math.min(255, R);
      d[pi + 1] = Math.min(255, G);
      d[pi + 2] = Math.min(255, B);
      d[pi + 3] = 255;
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
      aria-label="Victoria Yap — Head of SEO and Organic Growth"
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: "560px",
        overflow: "hidden",
        cursor: "crosshair",
        background: "#0d2830",
      }}
    >
      {/* Water canvas — aria-hidden so screen readers skip it */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* Text content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "10px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "rgba(93,202,165,0.45)",
            marginBottom: "14px",
          }}
        >
          Head of SEO &amp; Organic Growth
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
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
            }}
          >
            I&apos;m{" "}
            <span
              style={{
                borderBottom: "1.5px solid rgba(93,202,165,0.5)",
                paddingBottom: "2px",
              }}
            >
              Victoria Yap
            </span>
          </span>
        </div>

        <div
          aria-hidden="true"
          style={{
            width: "36px",
            height: "1px",
            background: "rgba(93,202,165,0.3)",
            margin: "4px auto 14px",
          }}
        />

        <p
          style={{
            fontFamily: "monospace",
            fontSize: "clamp(10px,1.2vw,12px)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(93,202,165,0.5)",
          }}
        >
          London · Fintech · Legal · Multilingual SEO
        </p>

        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "36px",
            pointerEvents: "all",
            flexWrap: "wrap",
            justifyContent: "center",
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
              borderRadius: "2px",
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
              borderRadius: "2px",
            }}
          >
            Get In Touch
          </a>
        </div>
      </div>

      {/* Interaction hint */}
      <p
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 3,
          fontFamily: "monospace",
          fontSize: "9px",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "rgba(93,202,165,0.2)",
          whiteSpace: "nowrap",
        }}
      >
        drag to part · click to drop · double-click for splash
      </p>
    </section>
  );
}