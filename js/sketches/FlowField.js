/**
 * FlowField.js
 *
 * Full-screen Perlin noise flow field with particle animation.
 * Wraps two canvas Layers (native browser APIs, no p5.js):
 *   • Main layer    — background fade, particle physics, normal particle rendering
 *   • Overlay layer — burst shapes + debug graph (transparent, clears each frame)
 *
 * Usage:
 *   const ff = new FlowField(document.querySelector('#bg'));
 *
 * Public surface:
 *   ff.particles              — live particle array (read; don't replace the ref)
 *   ff.params                 — live parameter object; mutate freely each frame
 *   ff.setHoverRect(rect|null) — attach an orbit attractor to a DOM element
 *   ff.toggleDebug()           — show / hide the debug panel + curve graph
 *   ff.destroy()               — tear down canvases, panel, and all listeners
 *
 * Debug panel: press ` (backtick) or click the ⚙ button to toggle.
 */

import { Particle } from './Particle.js';
import { Layer }    from './Layer.js';
import { noise }    from './noise.js';
import { Vec2 }     from './Vec2.js';
import { theme }    from '../core/theme.js';
import { Router }   from '../core/Router.js';

// ─── module constants ──────────────────────────────────────────────────────

/** Background colour — seeds and trail-fades the main canvas. */
const BG = theme.bg;

/**
 * Red tint applied to burst particles at the moment of impact.
 * Lerps back toward particleColor over the float+return phases.
 * @type {[number, number, number]}
 */
const BURST_COLOR = [220, 65, 45];

/**
 * Shape cycle — each tap advances through this list in order.
 * All particles from one tap share the same shape; prior bursts keep theirs.
 */
const BURST_SHAPES = ['star', 'triangle', 'eighth', 'heart', 'saxophone', 'spiral'];

/**
 * Colour palette for burst shapes — cycles through one colour per tap.
 * All particles from a single tap share the same snapshotted colour.
 */
const BURST_PALETTE = [
  [ 58,  82, 158],  // dark slate blue
  [ 72, 130, 228],  // bright cornflower
  [172,  18, 208],  // vivid magenta
  [108,  12, 198],  // deep royal purple
  [152, 148, 212],  // soft lavender
];

const TWO_PI = Math.PI * 2;

// ─── easing helpers ────────────────────────────────────────────────────────

/** Cubic smoothstep — maps t ∈ [0, 1] to a smooth S-curve. Input is clamped. */
function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Linear interpolation from a to b at blend factor t. */
function lerp(a, b, t) { return a + (b - a) * t; }

/** Convert 0-255 alpha to CSS rgba string. */
function rgba(r, g, b, a255) {
  return `rgba(${r},${g},${b},${(a255 / 255).toFixed(3)})`;
}

// ─── catmull-rom spline ────────────────────────────────────────────────────

/**
 * Draw a Catmull-Rom spline through a flat array of [x,y,x,y,...] points.
 * Matches p5's curveVertex() behaviour with duplicated endpoints.
 *
 * Converts each Catmull-Rom segment to a cubic Bézier using the standard
 * formula: cp = P1 + (P2 - P0) / 6  (uniform parameterisation, tension = 0.5)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} pts - flat [x0,y0, x1,y1, ..., xn,yn]
 */
function catmullRomSpline(ctx, pts) {
  const n = pts.length >> 1;   // number of points
  if (n < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);

  for (let i = 0; i < n - 1; i++) {
    // Control points: P0 (before), P1 (current), P2 (next), P3 (after)
    const p0x = i === 0     ? pts[0]             : pts[(i - 1) * 2];
    const p0y = i === 0     ? pts[1]             : pts[(i - 1) * 2 + 1];
    const p1x = pts[i * 2];
    const p1y = pts[i * 2 + 1];
    const p2x = pts[(i + 1) * 2];
    const p2y = pts[(i + 1) * 2 + 1];
    const p3x = i + 2 < n ? pts[(i + 2) * 2]     : pts[(n - 1) * 2];
    const p3y = i + 2 < n ? pts[(i + 2) * 2 + 1] : pts[(n - 1) * 2 + 1];

    // Catmull-Rom → cubic Bézier
    const cp1x = p1x + (p2x - p0x) / 6;
    const cp1y = p1y + (p2y - p0y) / 6;
    const cp2x = p2x - (p3x - p1x) / 6;
    const cp2y = p2y - (p3y - p1y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y);
  }
  ctx.stroke();
}

/**
 * Same math as catmullRomSpline, but appends to a Path2D instead of drawing.
 * Used to build a cached path that can be re-stroked cheaply each frame.
 */
function catmullRomToPath(path, pts) {
  const n = pts.length >> 1;
  if (n < 2) return;
  path.moveTo(pts[0], pts[1]);
  for (let i = 0; i < n - 1; i++) {
    const p0x = i === 0 ? pts[0]           : pts[(i - 1) * 2];
    const p0y = i === 0 ? pts[1]           : pts[(i - 1) * 2 + 1];
    const p1x = pts[i * 2],       p1y = pts[i * 2 + 1];
    const p2x = pts[(i + 1) * 2], p2y = pts[(i + 1) * 2 + 1];
    const p3x = i + 2 < n ? pts[(i + 2) * 2]     : pts[(n - 1) * 2];
    const p3y = i + 2 < n ? pts[(i + 2) * 2 + 1] : pts[(n - 1) * 2 + 1];
    path.bezierCurveTo(
      p1x + (p2x - p0x) / 6, p1y + (p2y - p0y) / 6,
      p2x - (p3x - p1x) / 6, p2y - (p3y - p1y) / 6,
      p2x, p2y,
    );
  }
}

// ─── slider definitions ────────────────────────────────────────────────────
//
// Drives both the DEFAULTS object and the debug panel UI.
// Entries with a `section` key insert a section-header row in the panel.
// Entries with a `key` key define a live slider for that parameter.

const SLIDER_DEFS = [
  { key: 'noiseScale',      label: 'Noise scale',    min: 0.0005, max: 0.012,  step: 0.0001,  decimals: 4 },
  { key: 'noiseSpeed',      label: 'Noise speed',    min: 0.00005,max: 0.002,  step: 0.00005, decimals: 5 },
  { key: 'particleSpeed',   label: 'Speed',          min: 0.5,    max: 12,     step: 0.1,     decimals: 1 },
  { key: 'particleCount',   label: 'Particles',      min: 50,     max: 2000,   step: 50,      decimals: 0 },
  { key: 'contourLevels',   label: 'Iso levels',     min: 2,      max: 24,     step: 1,       decimals: 0 },
  { section: 'Burst physics' },
  { key: 'repulseRadius',   label: 'Radius',         min: 10,     max: 500,    step: 5,       decimals: 0 },
  { key: 'repulseStrength', label: 'Strength',       min: 0,      max: 200,    step: 0.5,     decimals: 1 },
  { key: 'burstDur',        label: 'Burst frames',   min: 5,      max: 60,     step: 1,       decimals: 0 },
  { key: 'floatDur',        label: 'Float frames',   min: 10,     max: 200,    step: 5,       decimals: 0 },
  { key: 'returnDur',       label: 'Return frames',  min: 20,     max: 300,    step: 5,       decimals: 0 },
  { key: 'burstDrag',       label: 'Burst drag',     min: 0.75,   max: 0.99,   step: 0.01,    decimals: 2 },
  { key: 'floatDrag',       label: 'Float drag',     min: 0.90,   max: 1.00,   step: 0.005,   decimals: 3 },
  { key: 'driftStrength',   label: 'Drift strength', min: 0,      max: 0.30,   step: 0.005,   decimals: 3 },
];

// ─── defaults ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  // ── flow field ────────────────────────────────────────────────────────────
  particleCount:   500,
  noiseScale:      0.0043,   // spatial frequency of the Perlin noise field
  noiseSpeed:      0.00020,  // how fast the field evolves over time
  particleSpeed:   2.8,      // max speed enforced by Particle.update() via vel.limit()
  trailAlpha:      60,       // background-overlay alpha per frame — lower = longer trails
  particleAlpha:   140,      // particle stroke alpha (0–255)
  particleSize:    1.0,      // stroke weight in pixels
  particleColor:   theme.particle, // [r, g, b] — single source of truth for teal particle colour
  contourAlpha:    15,       // iso-contour line opacity (0 = off)
  contourLevels:   24,       // number of iso-value contour lines drawn
  vectorAlpha:     0,        // flow-direction tick-mark opacity (0 = off)

  // ── click / tap burst ─────────────────────────────────────────────────────
  repulseRadius:   115,      // explosion radius in pixels
  repulseStrength: 20,       // outward impulse magnitude

  // ── burst animation phases ─────────────────────────────────────────────────
  //   BURST  (burstDur  frames) — outward blast; strong drag; flow field off
  //   FLOAT  (floatDur  frames) — momentum carries; gentle drift; field barely on
  //   RETURN (returnDur frames) — flow field eases back to full strength
  burstDur:        5,
  floatDur:        45,
  returnDur:       120,
  burstDrag:       0.98,     // base drag during burst (ramps to +0.06 by end)
  floatDrag:       0.925,    // base drag during float (ramps to +0.03 via smoothstep)
  driftStrength:   0.00,     // peak downward force during float phase

  // ── internal / debug ──────────────────────────────────────────────────────
  showCurves:      false,    // controlled by panel visibility; not exposed as a slider
};

// ══════════════════════════════════════════════════════════════════════════════
//  FlowField
// ══════════════════════════════════════════════════════════════════════════════

export class FlowField {
  /**
   * @param {HTMLElement} containerEl - element to mount both canvases into
   * @param {object}      [options]   - override any key from DEFAULTS
   */
  constructor(containerEl, options = {}) {
    this.container = containerEl;

    /** Live parameters — mutate freely; the sketch reads these every frame. */
    this.params = { ...DEFAULTS, ...options };

    /**
     * Live particle array. Other components may read positions/velocities.
     * Do NOT replace this reference — only mutate its contents.
     * @type {Particle[]}
     */
    this.particles = [];

    // ── private state ──────────────────────────────────────────────────────
    this._t              = 0;      // Perlin noise time offset (advances each frame)
    this._frame          = 0;      // global frame counter
    this._mainLayer      = null;
    this._overlayLayer   = null;
    this._debugPanel     = null;
    this._debugToggleBtn = null;
    this._debugVisible   = false;
    this._hoverRect      = null;
    this._latestBurstAt  = -9999;
    this._shapeIndex     = 0;
    this._colorIndex     = 0;

    // ── live canvas dimensions shared with Particle instances ──────────────
    // Updated in onResize so all particles see the new size automatically.
    this._dims = { width: window.innerWidth, height: window.innerHeight };

    // ── mouse position (updated by mousemove on main canvas) ───────────────
    this._mouseX = 0;
    this._mouseY = 0;

    // ── fps counter ────────────────────────────────────────────────────────
    this._fpsEl         = null;
    this._fpsLastTime   = performance.now();
    this._fpsFrameCount = 0;

    // ── debug curve graph ──────────────────────────────────────────────────
    this._curveSamples    = null;
    this._curveSamplesKey = '';
    this._graphScale      = 1.0;
    this._graphDragging   = false;
    this._dragStartX      = 0;
    this._dragStartY      = 0;
    this._dragStartScale  = 1.0;

    // ── contour scratch buffers ────────────────────────────────────────────
    this._contourGrid       = null;
    this._cSeg = null; this._cHas = null; this._cUsed = null;
    this._cFwd = []; this._cBwd = []; this._cChain = [];

    // ── contour path cache ─────────────────────────────────────────────────
    this._contourPath       = null;   // cached Path2D, re-stroked each frame
    this._contourCacheFrame = -999;   // _frame when path was last rebuilt
    this._contourCacheW     = 0;
    this._contourCacheH     = 0;

    // ── init ───────────────────────────────────────────────────────────────
    this._initSketch();
    this._initOverlaySketch();
    this._initDebugPanel();

    this._onKey = (e) => { if (e.key === '`') this.toggleDebug(); };
    window.addEventListener('keydown', this._onKey);

    this._onHashChange = () => { if (this._debugVisible) this.toggleDebug(); };
    window.addEventListener('hashchange', this._onHashChange);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Burst physics
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Returns per-frame physics values for a burst particle at `frame`.
   *
   * Phase timeline (durations read from live params so sliders apply immediately):
   *   [0, burstDur)        → BURST  — outburst; drag rises; flow field silent
   *   [burstDur, floatEnd) → FLOAT  — momentum + downward drift; field whisper
   *   [floatEnd, totalDur) → RETURN — flow field eases back to full weight
   *   frame >= totalDur    → null   — burst fully complete; clear burstState
   *
   * @param {number} frame
   * @returns {{ phase, ffWeight, drag, drift, colorT } | null}
   */
  _burstPhysics(frame) {
    const { burstDur, floatDur, returnDur, driftStrength, burstDrag, floatDrag } = this.params;
    const floatEnd = burstDur + floatDur;
    const totalDur = floatEnd + returnDur;

    if (frame >= totalDur) return null;

    if (frame < burstDur) {
      const t = frame / burstDur;
      return { phase: 'burst', ffWeight: 0, drag: burstDrag + t * 0.06, drift: 0, colorT: 0 };
    }

    if (frame < floatEnd) {
      const t = (frame - burstDur) / floatDur;
      return {
        phase    : 'float',
        ffWeight : 0.04,
        drag     : floatDrag + smoothstep(t) * 0.03,
        drift    : driftStrength * Math.sin(t * Math.PI * 0.85 + Math.PI * 0.15),
        colorT   : 0,
      };
    }

    const t  = (frame - floatEnd) / returnDur;
    const ss = smoothstep(t);
    return {
      phase    : 'return',
      ffWeight : 0.04 + ss * 0.96,
      drag     : 1.0,
      drift    : 0,
      colorT   : ss * ss,
    };
  }

  /**
   * Kicks all particles within repulseRadius outward from (cx, cy).
   * @param {number} cx - burst origin x
   * @param {number} cy - burst origin y
   */
  _applyBurst(cx, cy) {
    const R = this.params.repulseRadius;
    const S = this.params.repulseStrength;
    if (S <= 0) return;

    const shape      = BURST_SHAPES[this._shapeIndex % BURST_SHAPES.length];
    const burstColor = BURST_PALETTE[this._colorIndex % BURST_PALETTE.length];
    this._shapeIndex++;
    this._colorIndex++;

    for (const pt of this.particles) {
      const dx   = pt.pos.x - cx;
      const dy   = pt.pos.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= R || dist < 1) continue;

      const strengthMult = 1.0 + (Math.random() - 0.5) * 0.28;
      const angleOffset  = (Math.random() - 0.5) * (Math.PI * 4 / 45);

      const cosA = Math.cos(angleOffset);
      const sinA = Math.sin(angleOffset);
      const ux   = dx / dist;
      const uy   = dy / dist;
      const rx   = ux * cosA - uy * sinA;
      const ry   = ux * sinA + uy * cosA;

      const speed  = S * (1 - dist / R) * strengthMult;
      pt.vel.x     = rx * speed;
      pt.vel.y     = ry * speed;
      pt.acc.set(0, 0);

      if (pt.burstState) continue;

      pt.burstState = {
        frame      : 0,
        heading    : Math.atan2(ry, rx),
        shape,
        burstColor,
        burstDur   : this.params.burstDur,
        floatDur   : this.params.floatDur,
        returnDur  : this.params.returnDur,
      };
    }
    this._latestBurstAt = this._frame;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Burst shape rendering
  // ══════════════════════════════════════════════════════════════════════════

  _starColorT(frame, bs) {
    const floatEnd = bs.burstDur + bs.floatDur;
    if (frame < bs.burstDur) return 0;
    if (frame < floatEnd) return 0;
    const ss = smoothstep((frame - floatEnd) / bs.returnDur);
    return ss * ss;
  }

  /**
   * Draw the burst shape for a particle using native Canvas 2D API.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Particle}                pt
   */
  _drawBurstShape(ctx, pt) {
    const bs       = pt.burstState;
    const frame    = bs.frame;
    const floatEnd = bs.burstDur + bs.floatDur;
    const totalDur = floatEnd + bs.returnDur;
    const size     = pt._sizeOverride ?? this.params.particleSize;
    const maxR     = size * 4;

    let R, expandT;
    if (frame < bs.burstDur) {
      expandT = smoothstep(frame / bs.burstDur);
      R       = lerp(size * 1.5, maxR, expandT);
    } else {
      expandT       = 1;
      const shrinkT = smoothstep((frame - bs.burstDur) / (totalDur - bs.burstDur));
      R             = maxR * (1 - shrinkT * 0.9);
    }

    const returnMorphT = frame > floatEnd
      ? smoothstep((frame - floatEnd) / bs.returnDur)
      : 0;

    const colorT = this._starColorT(frame, bs);
    const nc     = this.params.particleColor;
    const bc     = bs.burstColor;
    const cr     = Math.round(lerp(bc[0], nc[0], colorT));
    const cg     = Math.round(lerp(bc[1], nc[1], colorT));
    const cb     = Math.round(lerp(bc[2], nc[2], colorT));

    const fadeIn  = Math.min(pt.age / 60, 1);
    const fadeOut = Math.min((pt.lifespan - pt.age) / 60, 1);
    const alpha   = Math.min(fadeIn, fadeOut) * this.params.particleAlpha;

    if (alpha < 2) return;

    const fillStyle   = rgba(cr, cg, cb, alpha * 0.7);
    const strokeStyle = rgba(cr, cg, cb, alpha);

    ctx.save();
    ctx.translate(pt.pos.x, pt.pos.y);
    ctx.rotate(bs.heading);

    switch (bs.shape) {
      case 'star':
        ctx.fillStyle   = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth   = 0.5;
        this._shapeStar(ctx, R, expandT, returnMorphT);
        break;
      case 'triangle':
        ctx.fillStyle   = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth   = 0.5;
        this._shapeTriangle(ctx, R);
        break;
      case 'eighth':
        ctx.fillStyle = fillStyle;
        this._shapeGlyph(ctx, '♪', R * 2.2);
        break;
      case 'heart':
        ctx.fillStyle   = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth   = 0.5;
        this._shapeHeart(ctx, R);
        break;
      case 'saxophone':
        ctx.fillStyle = fillStyle;
        this._shapeGlyph(ctx, '🎷', R * 1.45);
        break;
      case 'spiral':
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth   = 1.5;
        this._shapeSpiral(ctx, R);
        break;
    }

    ctx.restore();
  }

  _shapeStar(ctx, R, expandT, returnMorphT) {
    const starRatio = expandT < 1
      ? lerp(1.0, 0.4, expandT)
      : lerp(0.4, 1.0, returnMorphT);
    const ri = R * starRatio;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a   = (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R : ri;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else         ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  _shapeTriangle(ctx, R) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      else         ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  _shapeHeart(ctx, R) {
    const scale = R / 16;
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const t = (i / 30) * Math.PI * 2;
      const x =  16 * Math.pow(Math.sin(t), 3) * scale;
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  _shapeSpiral(ctx, R) {
    const turns = 2.5;
    const steps = 40;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t     = i / steps;
      const angle = t * turns * Math.PI * 2;
      const r     = t * R;
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else         ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.stroke();
  }

  _shapeGlyph(ctx, glyph, R) {
    ctx.font         = `${Math.round(R) * 2}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 0, 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Canvas layers
  // ══════════════════════════════════════════════════════════════════════════

  _initSketch() {
    const [br, bg, bb] = BG;

    this._mainLayer = new Layer(this.container, {
      onSetup: ({ ctx, width, height }) => {
        ctx.fillStyle = `rgb(${br},${bg},${bb})`;
        ctx.fillRect(0, 0, width, height);
        this._dims.width  = width;
        this._dims.height = height;
        for (let i = 0; i < this.params.particleCount; i++) {
          this.particles.push(new Particle(this._dims, this.params));
        }
      },
      onResize: ({ ctx, width, height }) => {
        this._dims.width  = width;
        this._dims.height = height;
        ctx.fillStyle = `rgb(${br},${bg},${bb})`;
        ctx.fillRect(0, 0, width, height);
      },
    });

    // ── background fade ────────────────────────────────────────────────────
    this._mainLayer.add('background', ({ ctx, width, height }) => {
      ctx.fillStyle = rgba(br, bg, bb, this.params.trailAlpha);
      ctx.fillRect(0, 0, width, height);
    });

    // ── optional debug overlays ────────────────────────────────────────────
    this._mainLayer.add('debug', ({ ctx, width, height }) => {
      if (this.params.vectorAlpha  > 0) this._drawVectors(ctx, width, height);
      if (this.params.contourAlpha > 0) this._drawContours(ctx, width, height);
    });

    // ── particle physics + normal particle draw ────────────────────────────
    this._mainLayer.add('particles', ({ ctx }) => {
      this._t += this.params.noiseSpeed;
      this._frame++;

      // FPS counter — update every 500 ms
      this._fpsFrameCount++;
      const now = performance.now();
      const elapsed = now - this._fpsLastTime;
      if (elapsed >= 500 && this._fpsEl) {
        this._fpsEl.textContent = `${Math.round(this._fpsFrameCount / (elapsed / 1000))} fps`;
        this._fpsFrameCount = 0;
        this._fpsLastTime   = now;
      }

      const { width, height } = this._dims;

      // Maintain particle count live
      while (this.particles.length < this.params.particleCount) {
        this.particles.push(new Particle(this._dims, this.params));
      }
      while (this.particles.length > this.params.particleCount) {
        this.particles.pop();
      }

      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];

        const nx    = pt.pos.x * this.params.noiseScale;
        const ny    = pt.pos.y * this.params.noiseScale;
        const angle = noise(nx, ny, this._t) * TWO_PI * 2;
        const ffx   = Math.cos(angle) * 0.8;
        const ffy   = Math.sin(angle) * 0.8;

        if (pt.burstState) {
          const phys = this._burstPhysics(pt.burstState.frame);

          if (!phys) {
            pt.burstState     = null;
            pt._colorOverride = undefined;
            pt._sizeOverride  = undefined;

          } else {
            const { phase, ffWeight, drag, drift, colorT } = phys;

            const nc = this.params.particleColor;
            pt._colorOverride = [
              Math.round(lerp(BURST_COLOR[0], nc[0], colorT)),
              Math.round(lerp(BURST_COLOR[1], nc[1], colorT)),
              Math.round(lerp(BURST_COLOR[2], nc[2], colorT)),
            ];
            pt._sizeOverride = lerp(this.params.particleSize * 2.5, this.params.particleSize, colorT);

            if (ffWeight > 0) pt.applyForce({ x: ffx * ffWeight, y: ffy * ffWeight });
            if (drift   > 0) pt.applyForce({ x: 0, y: drift });

            pt.vel.x *= drag;
            pt.vel.y *= drag;

            if (phase === 'burst') {
              pt.prevPos.set(pt.pos);
              pt.vel.add(pt.acc);
              pt.pos.add(pt.vel);
              pt.acc.set(0, 0);
              pt.age++;
              pt._wrapEdges();
            } else {
              pt.update();
            }

            pt.burstState.frame++;
          }
        }

        if (!pt.burstState) {
          pt.applyForce({ x: ffx, y: ffy });
          const orb = this._orbit(pt.pos.x, pt.pos.y);
          if (orb) pt.applyForce(orb);
          pt.update();
          pt.draw(ctx);
        }

        if (pt.isDead()) {
          pt.burstState     = null;
          pt._colorOverride = undefined;
          pt._sizeOverride  = undefined;
          pt.reset();
        }
      }
    });

    // ── mouse / touch ──────────────────────────────────────────────────────
    const canvas = this._mainLayer.canvas;

    canvas.addEventListener('mousemove', (e) => {
      this._mouseX = e.offsetX;
      this._mouseY = e.offsetY;
      if (!this._graphDragging) return;
      const delta = (this._dragStartX - e.offsetX + this._dragStartY - e.offsetY) * 0.003;
      this._graphScale = Math.max(0.5, Math.min(2.5, this._dragStartScale + delta));
    });

    canvas.addEventListener('mousedown', (e) => {
      if (this.params.showCurves && this._isOnResizeHandle()) {
        this._graphDragging  = true;
        this._dragStartX     = e.offsetX;
        this._dragStartY     = e.offsetY;
        this._dragStartScale = this._graphScale;
        return;
      }
      this._applyBurst(e.offsetX, e.offsetY);
    });

    canvas.addEventListener('mouseup', () => {
      this._graphDragging = false;
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const tx = e.touches[0].clientX - rect.left;
        const ty = e.touches[0].clientY - rect.top;
        this._applyBurst(tx, ty);
      }
    }, { passive: false });
  }

  _initOverlaySketch() {
    this._overlayLayer = new Layer(this.container, { clear: true, overlay: true });

    // Burst shapes — clear each frame so no trail accumulation
    this._overlayLayer.add('burstShapes', ({ ctx }) => {
      for (const pt of this.particles) {
        if (pt.burstState) this._drawBurstShape(ctx, pt);
      }
    });

    // Debug burst-curve graph
    this._overlayLayer.add('curveGraph', ({ ctx, width, height }) => {
      if (this.params.showCurves) this._drawCurveOverlay(ctx, width, height);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════════════════════

  setHoverRect(rect) {
    this._hoverRect = rect;
  }

  toggleDebug() {
    this._debugVisible = !this._debugVisible;
    this._debugPanel.style.display = this._debugVisible ? 'flex' : 'none';
    this._fpsEl.style.display      = this._debugVisible ? 'block' : 'none';
    if (this._debugVisible) { this._fpsLastTime = performance.now(); this._fpsFrameCount = 0; }
    this.params.showCurves = this._debugVisible;
    if (this._debugVisible && Router.current()) Router.navigate('');
  }

  destroy() {
    window.removeEventListener('keydown',    this._onKey);
    window.removeEventListener('hashchange', this._onHashChange);
    this._mainLayer.destroy();
    this._overlayLayer?.destroy();
    this._debugPanel?.remove();
    this._debugToggleBtn?.remove();
    this._fpsEl?.remove();
    this.particles = [];
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Particle orbit (nav hover effect)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Computes an orbit force for a particle near the hovered nav element.
   * @param {number} px - particle x
   * @param {number} py - particle y
   * @returns {Vec2|null}
   */
  _orbit(px, py) {
    const r = this._hoverRect;
    if (!r) return null;

    const cx   = (r.left + r.right)  / 2;
    const cy   = (r.top  + r.bottom) / 2;
    const dx   = px - cx;
    const dy   = py - cy;
    const dist = Math.hypot(dx, dy);

    const OUTER = 300;
    const ORBIT = Math.max(r.width * 0.75, 90);

    if (dist > OUTER || dist < 1) return null;

    const nx = dx / dist;
    const ny = dy / dist;
    const tx = -ny;
    const ty =  nx;

    const disp    = dist - ORBIT;
    const k       = disp > 0 ? 0.18 : 0.54;
    const radial  = -disp * k;
    const tangent = (1 - dist / OUTER) * 1.4;

    return new Vec2(
      nx * radial + tx * tangent,
      ny * radial + ty * tangent,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Flow-direction vector overlay
  // ══════════════════════════════════════════════════════════════════════════

  _drawVectors(ctx, width, height) {
    const CELL = 28;
    const LEN  = 7;
    const cols = Math.ceil(width  / CELL);
    const rows = Math.ceil(height / CELL);
    const ns   = this.params.noiseScale;
    const [fr, fg, fb] = theme.fg;

    ctx.strokeStyle = rgba(fr, fg, fb, this.params.vectorAlpha);
    ctx.lineWidth   = 0.7;

    // Batch all ticks in one path — same style throughout
    ctx.beginPath();
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const x     = c * CELL;
        const y     = r * CELL;
        const angle = noise(x * ns, y * ns, this._t) * TWO_PI * 2;
        const dx    = Math.cos(angle) * LEN;
        const dy    = Math.sin(angle) * LEN;
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
      }
    }
    ctx.stroke();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Contour lines (marching squares)
  // ══════════════════════════════════════════════════════════════════════════

  _drawContours(ctx, width, height) {
    const CELL   = 44;   // coarser grid — half resolution each axis (4× fewer cells)
    const SKIP   = 3;    // rebuild path every N frames; re-stroke cache on others

    const [fr, fg, fb] = theme.fg;
    ctx.strokeStyle = rgba(fr, fg, fb, this.params.contourAlpha);
    ctx.lineWidth   = 0.6;

    // ── re-stroke cached path if still fresh ─────────────────────────────
    if (
      this._contourPath &&
      this._frame - this._contourCacheFrame < SKIP &&
      this._contourCacheW === width &&
      this._contourCacheH === height
    ) {
      ctx.stroke(this._contourPath);
      return;
    }

    const cols   = Math.ceil(width  / CELL);
    const rows   = Math.ceil(height / CELL);
    const ns     = this.params.noiseScale;
    const stride = cols + 1;

    // ── 1. sample noise grid ──────────────────────────────────────────────
    if (!this._contourGrid || this._contourGrid.length < (rows + 1) * stride) {
      this._contourGrid = new Float32Array((rows + 1) * stride);
    }
    const grid = this._contourGrid;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        grid[r * stride + c] = noise(c * CELL * ns, r * CELL * ns, this._t);
      }
    }

    // ── 2. allocate scratch buffers ───────────────────────────────────────
    const n = rows * cols;
    if (!this._cSeg || this._cSeg.length < n * 4) {
      this._cSeg   = new Float32Array(n * 4);
      this._cHas   = new Uint8Array(n);
      this._cUsed  = new Uint8Array(n);
      this._cFwd   = [];
      this._cBwd   = [];
      this._cChain = [];
    }
    const seg = this._cSeg, has = this._cHas, used = this._cUsed;
    const fwd = this._cFwd, bwd = this._cBwd, chain = this._cChain;

    // Accumulate all arcs into a single Path2D for caching
    const path = new Path2D();

    // ── 3. per iso-level: build crossings, trace arcs, draw ───────────────

    const walk = (startR, startC, exX, exY, out) => {
      let r = startR, c = startC;
      while (true) {
        let moved = false;
        for (let d = 0; d < 4; d++) {
          const nr = r + (d === 0 ? -1 : d === 1 ? 1 : 0);
          const nc = c + (d === 2 ? -1 : d === 3 ? 1 : 0);
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const ni  = nr * cols + nc;
          if (!has[ni] || used[ni]) continue;
          const ni4 = ni << 2;
          const nax = seg[ni4], nay = seg[ni4 + 1];
          const nbx = seg[ni4 + 2], nby = seg[ni4 + 3];
          let nx, ny;
          if      (Math.abs(nax - exX) < 0.5 && Math.abs(nay - exY) < 0.5) { nx = nbx; ny = nby; }
          else if (Math.abs(nbx - exX) < 0.5 && Math.abs(nby - exY) < 0.5) { nx = nax; ny = nay; }
          else continue;
          used[ni] = 1;
          out.push(nx, ny);
          r = nr; c = nc; exX = nx; exY = ny;
          moved = true;
          break;
        }
        if (!moved) break;
      }
    };

    const levels = this.params.contourLevels;
    for (let li = 1; li <= levels; li++) {
      const L = li / (levels + 1);

      has.fill(0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tl = grid[r       * stride + c    ];
          const tr = grid[r       * stride + c + 1];
          const br = grid[(r + 1) * stride + c + 1];
          const bl = grid[(r + 1) * stride + c    ];
          const x0 = c * CELL, y0 = r * CELL;
          const pts = [];
          if ((tl - L) * (tr - L) < 0) { const t = (L - tl) / (tr - tl); pts.push(x0 + t * CELL, y0); }
          if ((tr - L) * (br - L) < 0) { const t = (L - tr) / (br - tr); pts.push(x0 + CELL, y0 + t * CELL); }
          if ((bl - L) * (br - L) < 0) { const t = (L - bl) / (br - bl); pts.push(x0 + t * CELL, y0 + CELL); }
          if ((tl - L) * (bl - L) < 0) { const t = (L - tl) / (bl - tl); pts.push(x0, y0 + t * CELL); }
          if (pts.length >= 4) {
            const i4 = (r * cols + c) << 2;
            seg[i4] = pts[0]; seg[i4 + 1] = pts[1];
            seg[i4 + 2] = pts[2]; seg[i4 + 3] = pts[3];
            has[r * cols + c] = 1;
          }
        }
      }

      used.fill(0);
      for (let start = 0; start < n; start++) {
        if (!has[start] || used[start]) continue;
        used[start] = 1;
        const r0 = (start / cols) | 0, c0 = start % cols;
        const i4  = start << 2;
        const ax  = seg[i4], ay = seg[i4 + 1];
        const bx  = seg[i4 + 2], by = seg[i4 + 3];

        fwd.length   = 0;
        bwd.length   = 0;
        chain.length = 0;

        walk(r0, c0, bx, by, fwd);
        walk(r0, c0, ax, ay, bwd);

        for (let i = bwd.length - 2; i >= 0; i -= 2) chain.push(bwd[i], bwd[i + 1]);
        chain.push(ax, ay, bx, by);
        for (let i = 0; i < fwd.length; i++) chain.push(fwd[i]);

        catmullRomToPath(path, chain);
      }
    }

    // ── store cache and stroke ────────────────────────────────────────────
    this._contourPath       = path;
    this._contourCacheFrame = this._frame;
    this._contourCacheW     = width;
    this._contourCacheH     = height;
    ctx.stroke(path);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Burst-curve overlay — cache + layout
  // ══════════════════════════════════════════════════════════════════════════

  _buildCurveSamples() {
    const totalDur   = this.params.burstDur + this.params.floatDur + this.params.returnDur;
    const driftScale = Math.max(this.params.driftStrength, 0.001);

    const fieldSamples = new Float32Array(totalDur);
    const driftSamples = new Float32Array(totalDur);
    const velSamples   = new Float32Array(totalDur);
    const colorSamples = new Float32Array(totalDur);

    let vel = 1.0;
    for (let i = 0; i < totalDur; i++) {
      const phys = this._burstPhysics(i);
      if (phys) {
        fieldSamples[i] = phys.ffWeight;
        driftSamples[i] = phys.drift / driftScale;
        colorSamples[i] = phys.colorT;
        vel            *= phys.drag;
      }
      velSamples[i] = vel;
    }

    this._curveSamples = { fieldSamples, driftSamples, velSamples, colorSamples };
  }

  _graphLayout(width, height) {
    const sc = this._graphScale;
    const W  = Math.round(322 * sc);
    const H  = Math.round(190 * sc);
    const MR = 20, MB = 20;
    const ox = width  - W - MR;
    const oy = height - H - MB;

    const PL = Math.round(42 * sc);
    const PR = Math.round(14 * sc);
    const PT = Math.round(34 * sc);
    const PB = Math.round(40 * sc);

    const CW  = W - PL - PR;
    const CH  = H - PT - PB;
    const cx0 = ox + PL;
    const cy0 = oy + PT;
    const cx1 = cx0 + CW;
    const cy1 = cy0 + CH;

    const { burstDur, floatDur, returnDur } = this.params;
    const floatEnd = burstDur + floatDur;
    const totalDur = floatEnd + returnDur;
    const xFloat   = cx0 + (burstDur / totalDur) * CW;
    const xReturn  = cx0 + (floatEnd / totalDur) * CW;

    return { sc, W, H, ox, oy, CW, CH, cx0, cy0, cx1, cy1, xFloat, xReturn, totalDur, burstDur, floatEnd };
  }

  // ── curve plotting helpers ─────────────────────────────────────────────────

  _plotSolid(ctx, lo, samples, alpha, weight) {
    const { cx0, cy1, CW, CH, totalDur, sc } = lo;
    ctx.strokeStyle = rgba(0, 0, 0, alpha);
    ctx.lineWidth   = weight * sc;
    ctx.beginPath();
    for (let i = 0; i < totalDur; i++) {
      const x = cx0 + (i / (totalDur - 1)) * CW;
      const y = cy1 - Math.max(0, Math.min(1, samples[i])) * CH;
      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  _plotSegmented(ctx, lo, samples, alpha, weight, segLen, gapLen) {
    const { cx0, cy1, CW, CH, totalDur, sc } = lo;
    ctx.strokeStyle = rgba(0, 0, 0, alpha);
    ctx.lineWidth   = weight * sc;
    const cycle = segLen + gapLen;
    let open = false;
    ctx.beginPath();
    for (let i = 0; i < totalDur; i++) {
      const draw = (i % cycle) < segLen;
      const x    = cx0 + (i / (totalDur - 1)) * CW;
      const y    = cy1 - Math.max(0, Math.min(1, samples[i])) * CH;
      if ( draw && !open) { ctx.moveTo(x, y); open = true; }
      else if (!draw &&  open) { open = false; }
      else if ( draw) { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }

  _plotColorGradient(ctx, lo, samples, weight, segLen, gapLen) {
    const { cx0, cy1, CW, CH, totalDur, sc } = lo;
    const nc    = this.params.particleColor;
    const cycle = segLen + gapLen;
    ctx.lineWidth = weight * sc;
    for (let i = 0; i < totalDur - 1; i++) {
      if ((i % cycle) >= segLen) continue;
      const t  = samples[i];
      const r  = Math.round(lerp(BURST_COLOR[0], nc[0], t));
      const g  = Math.round(lerp(BURST_COLOR[1], nc[1], t));
      const b  = Math.round(lerp(BURST_COLOR[2], nc[2], t));
      ctx.strokeStyle = rgba(r, g, b, 210);
      ctx.beginPath();
      ctx.moveTo(cx0 + (i       / (totalDur - 1)) * CW, cy1 - Math.max(0, Math.min(1, samples[i]))     * CH);
      ctx.lineTo(cx0 + ((i + 1) / (totalDur - 1)) * CW, cy1 - Math.max(0, Math.min(1, samples[i + 1])) * CH);
      ctx.stroke();
    }
  }

  // ── overlay sub-methods ────────────────────────────────────────────────────

  _drawCurveChrome(ctx, lo) {
    const { sc, ox, oy, W, H, cx0, cy0, cx1, cy1, CW, CH, xFloat, xReturn, totalDur } = lo;

    // Corner accent marks
    const CA = Math.round(9 * sc);
    ctx.strokeStyle = rgba(0, 0, 0, 40);
    ctx.lineWidth   = 0.8 * sc;
    ctx.beginPath();
    [[ox, oy, 1, 1], [ox + W, oy, -1, 1], [ox, oy + H, 1, -1], [ox + W, oy + H, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.moveTo(x, y); ctx.lineTo(x + sx * CA, y);
      ctx.moveTo(x, y); ctx.lineTo(x, y + sy * CA);
    });
    ctx.stroke();

    // Hairline below header area
    ctx.strokeStyle = rgba(0, 0, 0, 22);
    ctx.lineWidth   = 0.5 * sc;
    ctx.beginPath();
    ctx.moveTo(ox + 6, cy0 - Math.round(7 * sc));
    ctx.lineTo(ox + W - 6, cy0 - Math.round(7 * sc));
    ctx.stroke();

    // Resize handle — 2×3 dot grid
    const hx   = ox + Math.round(8 * sc);
    const hy   = oy + Math.round(8 * sc);
    const dotR = 1.5 * sc;
    const dotS = 3.5 * sc;
    ctx.fillStyle = rgba(0, 0, 0, this._graphDragging ? 200 : 90);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.beginPath();
        ctx.arc(hx + col * dotS, hy + row * dotS, dotR, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Header text
    ctx.fillStyle    = rgba(0, 0, 0, 210);
    ctx.font         = `${Math.round(11 * sc)}px Courier New`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('BURST  CURVES', cx0, oy + Math.round(11 * sc));

    ctx.font         = `${Math.round(7 * sc)}px Courier New`;
    ctx.textAlign    = 'right';
    ctx.fillStyle    = rgba(0, 0, 0, 60);
    ctx.fillText(`t / ${totalDur}`, cx1, oy + Math.round(12 * sc));

    // Float-phase background shading
    ctx.fillStyle = rgba(0, 0, 0, 4);
    ctx.fillRect(xFloat, cy0, xReturn - xFloat, CH);

    // Phase labels above chart
    ctx.font         = `${Math.round(7.5 * sc)}px Courier New`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle    = rgba(0, 0, 0, 55);
    ctx.fillText('· BURST ·',  (cx0     + xFloat)  / 2, cy0 - Math.round(3 * sc));
    ctx.fillText('· FLOAT ·',  (xFloat  + xReturn) / 2, cy0 - Math.round(3 * sc));
    ctx.fillText('· RETURN ·', (xReturn + cx1)     / 2, cy0 - Math.round(3 * sc));

    // Horizontal grid lines at 0, 0.25, 0.5, 0.75, 1
    ctx.lineWidth = 0.5 * sc;
    for (let g = 0; g <= 4; g++) {
      const gy = cy1 - g * CH / 4;
      ctx.strokeStyle = rgba(0, 0, 0, g === 0 || g === 4 ? 35 : 14);
      ctx.beginPath();
      ctx.moveTo(cx0, gy);
      ctx.lineTo(cx1, gy);
      ctx.stroke();
    }

    // Phase boundary dotted verticals
    [xFloat, xReturn].forEach(x => {
      for (let dy = cy0; dy < cy1; dy += Math.round(5 * sc)) {
        ctx.strokeStyle = rgba(0, 0, 0, 30);
        ctx.beginPath();
        ctx.moveTo(x, dy);
        ctx.lineTo(x, Math.min(dy + Math.round(2 * sc), cy1));
        ctx.stroke();
      }
    });

    // Y-axis labels
    ctx.font         = `${Math.round(8 * sc)}px Courier New`;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = rgba(0, 0, 0, 90);
    ctx.fillText('1',  cx0 - Math.round(5 * sc), cy0);
    ctx.fillText('.5', cx0 - Math.round(5 * sc), cy0 + CH / 2);
    ctx.fillText('0',  cx0 - Math.round(5 * sc), cy1);
  }

  _drawCurvePlayhead(ctx, lo) {
    const { sc, cx0, cy0, cx1, cy1, CW, oy, totalDur } = lo;
    const playFrame = this._frame - this._latestBurstAt;
    if (playFrame < 0 || playFrame >= totalDur) return;

    const phx = cx0 + (playFrame / totalDur) * CW;

    // Scan line + end ticks
    ctx.strokeStyle = rgba(0, 0, 0, 175);
    ctx.lineWidth   = 1 * sc;
    ctx.beginPath();
    ctx.moveTo(phx, cy0); ctx.lineTo(phx, cy1);
    ctx.moveTo(phx - 3 * sc, cy0); ctx.lineTo(phx + 3 * sc, cy0);
    ctx.moveTo(phx - 3 * sc, cy1); ctx.lineTo(phx + 3 * sc, cy1);
    ctx.stroke();

    // Frame counter above the line
    ctx.fillStyle    = rgba(0, 0, 0, 195);
    ctx.font         = `${Math.round(8 * sc)}px Courier New`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`t = ${playFrame}`, phx, cy0 - Math.round(3 * sc));

    // Phase dot + label
    const phys = this._burstPhysics(playFrame);
    if (phys) {
      ctx.fillStyle = rgba(0, 0, 0, 190);
      ctx.beginPath();
      ctx.arc(cx1 - 5 * sc, oy + Math.round(13 * sc), 2 * sc, 0, TWO_PI);
      ctx.fill();

      ctx.font         = `${Math.round(8 * sc)}px Courier New`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = rgba(0, 0, 0, 140);
      ctx.fillText(phys.phase.toUpperCase(), cx1 - Math.round(13 * sc), oy + Math.round(13 * sc));
    }
  }

  _drawCurveLegend(ctx, lo) {
    const { sc, cx0, cy1 } = lo;
    const legY = cy1 + Math.round(19 * sc);
    const nc   = this.params.particleColor;

    ctx.font         = `${Math.round(8 * sc)}px Courier New`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    const ENTRIES = [
      {
        label: 'FLOW FIELD',
        draw : (x) => {
          ctx.strokeStyle = rgba(0, 0, 0, 195);
          ctx.lineWidth   = 1.8 * sc;
          ctx.beginPath();
          ctx.moveTo(x, legY);
          ctx.lineTo(x + 12 * sc, legY);
          ctx.stroke();
        },
      },
      {
        label: 'SPEED',
        draw : (x) => {
          ctx.strokeStyle = rgba(0, 0, 0, 130);
          ctx.lineWidth   = 1.0 * sc;
          ctx.beginPath();
          ctx.moveTo(x, legY);
          ctx.lineTo(x + 12 * sc, legY);
          ctx.stroke();
        },
      },
      {
        label: 'DRIFT',
        draw : (x) => {
          ctx.strokeStyle = rgba(0, 0, 0, 100);
          ctx.lineWidth   = 0.8 * sc;
          ctx.beginPath();
          for (let xi = x; xi < x + 12 * sc; xi += 4 * sc) {
            ctx.moveTo(xi, legY);
            ctx.lineTo(Math.min(xi + 2 * sc, x + 12 * sc), legY);
          }
          ctx.stroke();
        },
      },
      {
        label: 'TINT + SIZE',
        draw : (x) => {
          ctx.lineWidth = 1.6 * sc;
          const w = 12 * sc;
          for (let i = 0; i < w; i += 3 * sc) {
            const t = i / w;
            const r = Math.round(lerp(BURST_COLOR[0], nc[0], t));
            const g = Math.round(lerp(BURST_COLOR[1], nc[1], t));
            const b = Math.round(lerp(BURST_COLOR[2], nc[2], t));
            ctx.strokeStyle = rgba(r, g, b, 220);
            ctx.beginPath();
            ctx.moveTo(x + i, legY);
            ctx.lineTo(Math.min(x + i + 1.5 * sc, x + w), legY);
            ctx.stroke();
          }
        },
      },
    ];

    let legX = cx0;
    ENTRIES.forEach(({ label, draw }) => {
      draw(legX);
      ctx.fillStyle = rgba(0, 0, 0, 120);
      ctx.fillText(label, legX + 16 * sc, legY);
      legX += 16 * sc + ctx.measureText(label).width + 10 * sc;
    });
  }

  _drawCurveOverlay(ctx, width, height) {
    const cacheKey = `${this.params.burstDur},${this.params.floatDur},${this.params.returnDur},${this.params.burstDrag},${this.params.floatDrag},${this.params.driftStrength}`;
    if (!this._curveSamples || this._curveSamplesKey !== cacheKey) {
      this._buildCurveSamples();
      this._curveSamplesKey = cacheKey;
    }
    const { fieldSamples, driftSamples, velSamples, colorSamples } = this._curveSamples;

    const lo = this._graphLayout(width, height);

    ctx.save();

    this._drawCurveChrome(ctx, lo);
    this._plotSegmented(ctx,     lo, driftSamples, 100, 0.8, 8, 4);
    this._plotSolid(ctx,         lo, velSamples,   130, 1.0);
    this._plotColorGradient(ctx, lo, colorSamples, 1.6, 3, 3);
    this._plotSolid(ctx,         lo, fieldSamples, 200, 1.8);
    this._drawCurvePlayhead(ctx, lo);
    this._drawCurveLegend(ctx, lo);

    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Resize handle hit test
  // ══════════════════════════════════════════════════════════════════════════

  _isOnResizeHandle() {
    const sc = this._graphScale;
    const W  = Math.round(322 * sc);
    const H  = Math.round(190 * sc);
    const ox = this._dims.width  - W - 20;
    const oy = this._dims.height - H - 20;
    return Math.hypot(this._mouseX - (ox + 8 * sc), this._mouseY - (oy + 8 * sc)) < 14;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Debug panel
  // ══════════════════════════════════════════════════════════════════════════

  _initDebugPanel() {
    const panel = document.createElement('div');
    panel.className = 'ff-debug';
    panel.setAttribute('aria-label', 'FlowField debug controls');

    const rows = SLIDER_DEFS.map((def) => {
      if (def.section) {
        return `<div class="ff-debug__section-label">${def.section}</div>`;
      }
      const { key, label, min, max, step } = def;
      return `
        <label class="ff-debug__row">
          <span class="ff-debug__label">${label}</span>
          <input
            type="range"
            class="ff-debug__slider"
            data-param="${key}"
            min="${min}" max="${max}" step="${step}"
            value="${this.params[key]}"
          >
          <span class="ff-debug__value" data-value="${key}"></span>
        </label>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="ff-debug__header">
        <span>FlowField</span>
        <div class="ff-debug__header-right">
          <kbd>\`</kbd>
          <button class="ff-debug__close" title="Close">×</button>
        </div>
      </div>
      ${rows}
      <button class="ff-debug__reset">Reset</button>
    `;

    panel.style.display = 'none';
    document.body.appendChild(panel);
    this._debugPanel = panel;

    const fpsEl = document.createElement('div');
    fpsEl.className     = 'ff-fps';
    fpsEl.style.display = 'none';
    fpsEl.textContent   = '— fps';
    document.body.appendChild(fpsEl);
    this._fpsEl         = fpsEl;
    this._fpsLastTime   = performance.now();
    this._fpsFrameCount = 0;

    const btn = document.createElement('button');
    btn.className   = 'ff-debug-toggle';
    btn.title       = 'Toggle debug panel (`)';
    btn.textContent = '⚙';
    btn.addEventListener('click', () => this.toggleDebug());
    document.body.appendChild(btn);
    this._debugToggleBtn = btn;

    panel.querySelector('.ff-debug__close').addEventListener('click', () => this.toggleDebug());

    SLIDER_DEFS.filter(d => d.key).forEach(({ key, decimals }) => {
      const slider  = panel.querySelector(`input[data-param="${key}"]`);
      const valueEl = panel.querySelector(`[data-value="${key}"]`);

      valueEl.textContent = Number(this.params[key]).toFixed(decimals);

      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        this.params[key]    = val;
        valueEl.textContent = val.toFixed(decimals);
      });
    });

    panel.querySelector('.ff-debug__reset').addEventListener('click', () => {
      Object.assign(this.params, DEFAULTS);
      this.params.showCurves = this._debugVisible;
      SLIDER_DEFS.filter(d => d.key).forEach(({ key, decimals }) => {
        const slider  = panel.querySelector(`input[data-param="${key}"]`);
        const valueEl = panel.querySelector(`[data-value="${key}"]`);
        slider.value        = this.params[key];
        valueEl.textContent = Number(this.params[key]).toFixed(decimals);
      });
    });
  }
}
