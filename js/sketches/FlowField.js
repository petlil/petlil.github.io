/**
 * FlowField.js
 *
 * Full-screen Perlin noise flow field with particle animation.
 * Wraps two canvas Layers (each backed by a p5.js instance in instance mode):
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
 * ♪ is coloured by the burst colour; emoji (🎷) render in their native OS colour.
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

// ─── easing helpers ────────────────────────────────────────────────────────

/** Cubic smoothstep — maps t ∈ [0, 1] to a smooth S-curve. Input is clamped. */
function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Linear interpolation from a to b at blend factor t. */
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── slider definitions ────────────────────────────────────────────────────
//
// Drives both the DEFAULTS object and the debug panel UI.
// Entries with a `section` key insert a section-header row in the panel.
// Entries with a `key` key define a live slider for that parameter.

const SLIDER_DEFS = [
  { key: 'noiseScale',      label: 'Noise scale',    min: 0.0005, max: 0.012,  step: 0.0001,  decimals: 4 },
  { key: 'noiseSpeed',      label: 'Noise speed',    min: 0.00005,max: 0.002,  step: 0.00005, decimals: 5 },
  { key: 'particleSpeed',   label: 'Speed',          min: 0.5,    max: 12,     step: 0.1,     decimals: 1 },
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
//
// All burst-phase durations live here and are read live from this.params,
// so debug-panel sliders take effect immediately without a restart.

const DEFAULTS = {
  // ── flow field ────────────────────────────────────────────────────────────
  particleCount:   500,
  noiseScale:      0.0028,   // spatial frequency of the Perlin noise field
  noiseSpeed:      0.00035,  // how fast the field evolves over time
  particleSpeed:   4.7,      // max speed enforced by Particle.update() via vel.limit()
  trailAlpha:      60,       // background-overlay alpha per frame — lower = longer trails
  particleAlpha:   140,      // particle stroke alpha (0–255)
  particleSize:    1.0,      // stroke weight in pixels
  particleColor:   theme.particle, // [r, g, b] — single source of truth for teal particle colour
  contourAlpha:    15,       // iso-contour line opacity (0 = off)
  contourLevels:   30,       // number of iso-value contour lines drawn
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
   * @param {HTMLElement} containerEl - element to mount both p5 canvases into
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
    this._mainLayer      = null;   // main canvas layer (background, physics, normal particles)
    this._overlayLayer   = null;   // transparent overlay layer (burst shapes, curve graph)
    this._debugPanel     = null;   // debug panel DOM element
    this._debugToggleBtn = null;   // always-visible ⚙ button
    this._debugVisible   = false;
    this._hoverRect      = null;   // DOMRect of hovered nav item (orbit attractor)
    this._latestBurstAt  = -9999;  // _frame value when last burst fired (drives playhead)
    this._shapeIndex     = 0;      // cycles through BURST_SHAPES on each tap
    this._colorIndex     = 0;      // cycles through BURST_PALETTE on each tap

    // ── debug curve graph ──────────────────────────────────────────────────
    this._curveSamples    = null;  // cached Float32Arrays; rebuilt on param change
    this._curveSamplesKey = '';    // stringified burst params — cache invalidation key
    this._graphScale      = 1.0;  // graph panel scale (0.5 – 2.5)
    this._graphDragging   = false;
    this._dragStartX      = 0;
    this._dragStartY      = 0;
    this._dragStartScale  = 1.0;

    // ── init ───────────────────────────────────────────────────────────────
    this._initSketch();
    this._initOverlaySketch();
    this._initDebugPanel();

    // Backtick toggle works regardless of which element has focus
    this._onKey = (e) => { if (e.key === '`') this.toggleDebug(); };
    window.addEventListener('keydown', this._onKey);

    // Auto-close debug panel when the user navigates to a site section
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
   * @param {number} frame - frames elapsed since burst was applied
   * @returns {{ phase: string, ffWeight: number, drag: number, drift: number, colorT: number } | null}
   */
  _burstPhysics(frame) {
    const { burstDur, floatDur, returnDur, driftStrength, burstDrag, floatDrag } = this.params;
    const floatEnd = burstDur + floatDur;
    const totalDur = floatEnd + returnDur;

    if (frame >= totalDur) return null;

    if (frame < burstDur) {
      // BURST — pure outward blast; drag increases linearly to ease into float
      const t = frame / burstDur;
      return { phase: 'burst', ffWeight: 0, drag: burstDrag + t * 0.06, drift: 0, colorT: 0 };
    }

    if (frame < floatEnd) {
      // FLOAT — particle coasts with downward drift.
      // sin offset (π×0.15) ensures drift starts at ~45% on frame 0 of this phase,
      // avoiding the dead zone a plain sin(t·π) would create at t=0.
      const t = (frame - burstDur) / floatDur;
      return {
        phase    : 'float',
        ffWeight : 0.04,
        drag     : floatDrag + smoothstep(t) * 0.03,
        drift    : driftStrength * Math.sin(t * Math.PI * 0.85 + Math.PI * 0.15),
        colorT   : 0,  // hold burst colour through entire float phase
      };
    }

    // RETURN — flow field eases back; drag = 1.0 so velocity isn't artificially clamped
    const t  = (frame - floatEnd) / returnDur;
    const ss = smoothstep(t);
    return {
      phase    : 'return',
      ffWeight : 0.04 + ss * 0.96,
      drag     : 1.0,
      drift    : 0,
      colorT   : ss * ss,  // full fade happens during return only; accelerates toward end
    };
  }

  /**
   * Kicks all particles within repulseRadius outward from (cx, cy).
   *
   * A small per-particle randomisation (±14% strength, ±8° direction) makes
   * the burst feel organic rather than perfectly radial. Phase durations are
   * snapshotted on each particle so slider changes mid-burst don't glitch the
   * ongoing animation.
   *
   * @param {object} p  - p5 instance
   * @param {number} cx - burst origin x
   * @param {number} cy - burst origin y
   */
  _applyBurst(p, cx, cy) {
    const R = this.params.repulseRadius;
    const S = this.params.repulseStrength;
    if (S <= 0) return;

    // Advance the global shape + colour cycles independently — all particles from
    // this tap share the same shape and colour; prior bursts keep their snapshots.
    const shape      = BURST_SHAPES[this._shapeIndex % BURST_SHAPES.length];
    const burstColor = BURST_PALETTE[this._colorIndex % BURST_PALETTE.length];
    this._shapeIndex++;
    this._colorIndex++;

    for (const pt of this.particles) {
      const dx   = pt.pos.x - cx;
      const dy   = pt.pos.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= R || dist < 1) continue;

      // Per-particle jitter for an organic look
      const strengthMult = 1.0 + (Math.random() - 0.5) * 0.28;         // ±14%
      const angleOffset  = (Math.random() - 0.5) * (Math.PI * 4 / 45); // ±8°

      const cosA = Math.cos(angleOffset);
      const sinA = Math.sin(angleOffset);
      const ux   = dx / dist;                  // unit radial vector
      const uy   = dy / dist;
      const rx   = ux * cosA - uy * sinA;      // rotated outward direction
      const ry   = ux * sinA + uy * cosA;

      // Impulse falls off linearly with distance; replace velocity (not additive).
      // Applied to ALL in-range particles so they're physically pushed regardless.
      const speed  = S * (1 - dist / R) * strengthMult;
      pt.vel.x     = rx * speed;
      pt.vel.y     = ry * speed;
      pt.acc.set(0, 0);  // discard any pending forces

      // Only start a new shape animation if the particle has fully returned —
      // prevents mid-animation particles from being re-burst into a new shape.
      if (pt.burstState) continue;

      // Snapshot: lock orientation + freeze durations so mid-burst slider
      // changes don't glitch the star animation or colour transition.
      pt.burstState = {
        frame      : 0,
        heading    : Math.atan2(ry, rx),  // shape oriented toward launch direction
        shape,                             // frozen at burst time; cycle advances per tap
        burstColor,                        // colour snapshotted at burst time
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

  /**
   * Computes the normalised colour-blend progress (0 = gold, 1 = teal) for a
   * star particle at a given frame. Uses snapshotted burstState durations so
   * live param changes after a burst don't affect an ongoing animation.
   *
   * Mirrors the colorT arithmetic in _burstPhysics but is safe to call
   * independently because it doesn't touch this.params.
   *
   * @param {number} frame - pt.burstState.frame
   * @param {object} bs    - pt.burstState (burstDur / floatDur / returnDur)
   * @returns {number} t ∈ [0, 1]
   */
  _starColorT(frame, bs) {
    const floatEnd = bs.burstDur + bs.floatDur;
    if (frame < bs.burstDur) return 0;
    if (frame < floatEnd) return 0;  // hold burst colour through entire float phase
    const ss = smoothstep((frame - floatEnd) / bs.returnDur);
    return ss * ss;  // full fade during return only; accelerates toward end
  }

  /**
   * Draws the burst shape for a particle, dispatching to the appropriate
   * shape renderer based on pt.burstState.shape.
   *
   * All shapes share the same lifecycle:
   *   BURST  — expands from a small visible size (never invisible at frame 0) to maxR
   *   POST   — shrinks continuously; shape-specific forms morph back toward dots
   *
   * Uses the native Canvas 2D API (p.drawingContext) directly rather than p5
   * wrappers. This avoids the cost of p5's push()/pop() state copies,
   * beginShape()/vertex()/endShape() overhead, and textSize() font re-parsing —
   * all of which compound badly when dozens of burst particles animate at once.
   *
   * @param {CanvasRenderingContext2D} ctx - native 2D context from p.drawingContext
   * @param {Particle}                pt  - particle with a valid burstState
   */
  _drawBurstShape(ctx, pt) {
    const bs       = pt.burstState;
    const frame    = bs.frame;
    const floatEnd = bs.burstDur + bs.floatDur;
    const totalDur = floatEnd + bs.returnDur;
    const size     = pt._sizeOverride ?? this.params.particleSize;
    const maxR     = size * 4;  // peak radius at end of burst phase

    // ── outer radius and expand/morph progress ────────────────────────────
    // expandT: 0→1 during burst, stays 1 after.
    // R: grows from a small-but-visible minR to maxR, then shrinks 90%.
    let R, expandT;
    if (frame < bs.burstDur) {
      expandT = smoothstep(frame / bs.burstDur);
      R       = lerp(size * 1.5, maxR, expandT);
    } else {
      expandT       = 1;
      const shrinkT = smoothstep((frame - bs.burstDur) / (totalDur - bs.burstDur));
      R             = maxR * (1 - shrinkT * 0.9);
    }

    // returnMorphT: 0 during burst+float, 0→1 during return.
    // Drives the star inner-radius morph (star → circle) and similar effects.
    const returnMorphT = frame > floatEnd
      ? smoothstep((frame - floatEnd) / bs.returnDur)
      : 0;

    // ── colour — random burst colour → teal ──────────────────────────────
    const colorT = this._starColorT(frame, bs);
    const nc     = this.params.particleColor;
    const bc     = bs.burstColor;
    const cr     = Math.round(lerp(bc[0], nc[0], colorT));
    const cg     = Math.round(lerp(bc[1], nc[1], colorT));
    const cb     = Math.round(lerp(bc[2], nc[2], colorT));

    // ── alpha — mirrors Particle.draw() fade envelope ─────────────────────
    const fadeIn  = Math.min(pt.age / 60, 1);
    const fadeOut = Math.min((pt.lifespan - pt.age) / 60, 1);
    const alpha   = Math.min(fadeIn, fadeOut) * this.params.particleAlpha;

    if (alpha < 2) return;  // skip nearly-invisible shapes — free performance win

    // ── draw via native canvas API ────────────────────────────────────────
    // Fill is semi-transparent; stroke is fully opaque at the current alpha.
    const fillStyle   = `rgba(${cr},${cg},${cb},${(alpha * 0.7 / 255).toFixed(3)})`;
    const strokeStyle = `rgba(${cr},${cg},${cb},${(alpha / 255).toFixed(3)})`;

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
        this._shapeGlyph(ctx, '🎷', R * 1.45);  // saxophones slightly larger than other shapes
        break;
      case 'spiral':
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth   = 1.5;
        this._shapeSpiral(ctx, R);
        break;
    }

    ctx.restore();
  }

  /**
   * 5-pointed star via native canvas paths.
   * Inner radius morphs circle→star on expand, star→circle on return.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} R            - outer radius
   * @param {number} expandT      - 0→1 during burst expand, 1 once fully formed
   * @param {number} returnMorphT - 0→1 during return phase
   */
  _shapeStar(ctx, R, expandT, returnMorphT) {
    const starRatio = expandT < 1
      ? lerp(1.0, 0.4, expandT)       // expanding: circle → star
      : lerp(0.4, 1.0, returnMorphT); // shrinking: star → circle
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

  /**
   * Equilateral triangle, point oriented along the burst heading.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} R - circumradius
   */
  _shapeTriangle(ctx, R) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;  // top vertex first
      if (i === 0) ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      else         ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Parametric heart shape via the standard trig parameterisation.
   * y is negated because canvas y increases downward.
   * 30 steps is enough for a smooth curve at these sizes.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} R - approximate outer radius (maps to 16 units in the formula)
   */
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

  /**
   * Archimedean spiral: r(θ) grows from 0 to R over `turns` rotations.
   * Rendered as an open polyline — no fill. 40 steps is visually smooth.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} R - outer radius at the tip of the spiral
   */
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
    ctx.stroke();  // open path — no closePath/fill
  }

  /**
   * Single Unicode glyph or emoji, centred at origin, sized to ~2R diameter.
   * fillStyle must be set by the caller before this is invoked.
   *
   * Font size is rounded to the nearest even pixel so nearby particles share
   * the same compiled font string — the browser caches fonts per unique string,
   * so coarser quantisation means more cache hits and fewer re-parses per frame.
   *
   * ♪ is coloured by fillStyle; emoji (🎷 🎵) render in native OS colour
   * regardless of fillStyle, but globalAlpha (set via rgba fillStyle) still fades them.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} glyph - character to render
   * @param {number} R     - half the desired glyph height in pixels
   */
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
    this._mainLayer = new Layer(this.container, {
      onSetup: (p) => {
        p.background(...BG);
        for (let i = 0; i < this.params.particleCount; i++) {
          this.particles.push(new Particle(p, this.params));
        }
      },
      onResize: (p) => p.background(...BG),
    });

    // ── background fade ────────────────────────────────────────────────────
    // Semi-transparent fill each frame creates motion trails.
    // trailAlpha controls trail length: lower = longer trails.
    this._mainLayer.add('background', (p) => {
      p.noStroke();
      p.fill(...BG, this.params.trailAlpha);
      p.rect(0, 0, p.width, p.height);
    });

    // ── optional debug overlays (alpha 0 by default — invisible) ──────────
    this._mainLayer.add('debug', (p) => {
      if (this.params.vectorAlpha  > 0) this._drawVectors(p);
      if (this.params.contourAlpha > 0) this._drawContours(p);
    });

    // ── particle physics + normal particle draw ────────────────────────────
    // Burst shapes are NOT drawn here — they live on the overlay layer so
    // they clear every frame and never accumulate trail-fade artefacts.
    this._mainLayer.add('particles', (p) => {
      this._t += this.params.noiseSpeed;
      this._frame++;

      // Maintain particle count live so the slider takes effect immediately
      while (this.particles.length < this.params.particleCount) {
        this.particles.push(new Particle(p, this.params));
      }
      while (this.particles.length > this.params.particleCount) {
        this.particles.pop();
      }

      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];

        // Flow-field vector at this particle's position.
        // Computed unconditionally — burst particles use it at reduced weight.
        const nx    = pt.pos.x * this.params.noiseScale;
        const ny    = pt.pos.y * this.params.noiseScale;
        const angle = p.noise(nx, ny, this._t) * p.TWO_PI * 2;
        const ffx   = Math.cos(angle) * 0.8;
        const ffy   = Math.sin(angle) * 0.8;

        if (pt.burstState) {
          // ── burst path ────────────────────────────────────────────────
          const phys = this._burstPhysics(pt.burstState.frame);

          if (!phys) {
            // Burst fully complete — clear state, fall through to normal physics
            pt.burstState     = null;
            pt._colorOverride = undefined;
            pt._sizeOverride  = undefined;

          } else {
            const { phase, ffWeight, drag, drift, colorT } = phys;

            // Trail tint: BURST_COLOR (red) at impact, lerps back to teal
            const nc = this.params.particleColor;
            pt._colorOverride = [
              Math.round(lerp(BURST_COLOR[0], nc[0], colorT)),
              Math.round(lerp(BURST_COLOR[1], nc[1], colorT)),
              Math.round(lerp(BURST_COLOR[2], nc[2], colorT)),
            ];
            // Size: enlarged at impact, returns to normal as colorT approaches 1
            pt._sizeOverride = lerp(this.params.particleSize * 2.5, this.params.particleSize, colorT);

            // Partial flow-field influence (0 during burst, grows during float)
            if (ffWeight > 0) pt.applyForce(p.createVector(ffx * ffWeight, ffy * ffWeight));

            // Downward drift during float phase
            if (drift > 0) pt.applyForce(p.createVector(0, drift));

            // Apply drag coefficient directly to velocity before positional update
            pt.vel.x *= drag;
            pt.vel.y *= drag;

            if (phase === 'burst') {
              // Bypass vel.limit() so the initial outburst isn't capped.
              // By burst end, drag has reduced velocity below particleSpeed,
              // so normal limiting is safe from float phase onward.
              pt.prevPos.set(pt.pos);
              pt.vel.add(pt.acc);
              pt.pos.add(pt.vel);
              pt.acc.set(0, 0);
              pt.age++;
              pt._wrapEdges();
            } else {
              pt.update();  // uses vel.limit(particleSpeed)
            }

            pt.burstState.frame++;
          }
        }

        // ── normal physics ───────────────────────────────────────────────
        // Runs for non-burst particles, and also on the frame a burst
        // completes (burstState was just cleared above; same frame).
        if (!pt.burstState) {
          pt.applyForce(p.createVector(ffx, ffy));
          const orb = this._orbit(p, pt.pos.x, pt.pos.y);
          if (orb) pt.applyForce(orb);
          pt.update();
          pt.draw();  // normal teal dot; burst shapes rendered on overlay
        }

        // Reset dead particles in-place — keeps pool at a constant size
        if (pt.isDead()) {
          pt.burstState     = null;
          pt._colorOverride = undefined;
          pt._sizeOverride  = undefined;
          pt.reset();
        }
      }
    });

    // ── mouse / touch ──────────────────────────────────────────────────────
    const p = this._mainLayer.p;

    p.mousePressed = (e) => {
      if (e && e.target !== p.canvas) return;
      // Graph resize handle intercepts mousedown — don't also fire a burst
      if (this.params.showCurves && this._isOnResizeHandle(p)) {
        this._graphDragging  = true;
        this._dragStartX     = p.mouseX;
        this._dragStartY     = p.mouseY;
        this._dragStartScale = this._graphScale;
        return false;
      }
      this._applyBurst(p, p.mouseX, p.mouseY);
      return false;
    };

    p.mouseDragged = () => {
      if (!this._graphDragging) return;
      // Drag left / up → bigger graph; drag right / down → smaller
      const delta = (this._dragStartX - p.mouseX + this._dragStartY - p.mouseY) * 0.003;
      this._graphScale = Math.max(0.5, Math.min(2.5, this._dragStartScale + delta));
    };

    p.mouseReleased  = () => { this._graphDragging = false; };

    p.touchStarted = (e) => {
      if (e && e.target !== p.canvas) return;
      if (p.touches.length > 0) this._applyBurst(p, p.touches[0].x, p.touches[0].y);
      return false;
    };
  }

  _initOverlaySketch() {
    // Transparent overlay — clears every frame so nothing accumulates.
    // pointer-events: none lets clicks/taps fall through to the main canvas.
    this._overlayLayer = new Layer(this.container, { clear: true, overlay: true });

    // Burst shapes — rendered here so p.clear() wipes them each frame cleanly,
    // eliminating the trail-smear that would occur on the main canvas.
    // To move burst shapes back to the main canvas: remove this pass and
    // re-add drawBurstShape calls inside the 'particles' pass on _mainLayer.
    this._overlayLayer.add('burstShapes', (p) => {
      const ctx = p.drawingContext;
      for (const pt of this.particles) {
        if (pt.burstState) this._drawBurstShape(ctx, pt);
      }
    });

    // Debug burst-curve graph — only visible when the settings panel is open.
    this._overlayLayer.add('curveGraph', (p) => {
      if (this.params.showCurves) this._drawCurveOverlay(p);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Attach an orbit attractor to a DOM element. Particles near the element
   * will circle it counter-clockwise. Pass null to clear the effect.
   * @param {DOMRect|null} rect
   */
  setHoverRect(rect) {
    this._hoverRect = rect;
  }

  /** Show or hide the debug panel. The burst-curve graph follows panel visibility.
   *  Opening the panel also closes any active section so they don't overlap. */
  toggleDebug() {
    this._debugVisible = !this._debugVisible;
    this._debugPanel.style.display = this._debugVisible ? 'flex' : 'none';
    this.params.showCurves = this._debugVisible;
    if (this._debugVisible && Router.current()) Router.navigate('');
  }

  /**
   * Tear down all layers, the debug panel, and all event listeners.
   * Call this when removing the FlowField from the page.
   */
  destroy() {
    window.removeEventListener('keydown',    this._onKey);
    window.removeEventListener('hashchange', this._onHashChange);
    this._mainLayer.destroy();
    this._overlayLayer?.destroy();
    this._debugPanel?.remove();
    this._debugToggleBtn?.remove();
    this.particles = [];
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Particle orbit (nav hover effect)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Computes an orbit force for a particle near the hovered nav element.
   *
   * Two components act together:
   *   Radial spring  — attractive from outside the orbit ring, repulsive from
   *                    inside. 3× stiffer inside keeps the ring crisp.
   *   CCW tangential — sweeps particles around the ring; tapers to zero at the
   *                    outer influence boundary.
   *
   * @param {object} p  - p5 instance
   * @param {number} px - particle x
   * @param {number} py - particle y
   * @returns {p5.Vector|null} force vector, or null if particle is out of range
   */
  _orbit(p, px, py) {
    const r = this._hoverRect;
    if (!r) return null;

    const cx   = (r.left + r.right)  / 2;
    const cy   = (r.top  + r.bottom) / 2;
    const dx   = px - cx;
    const dy   = py - cy;
    const dist = Math.hypot(dx, dy);

    const OUTER = 300;                          // influence boundary (px)
    const ORBIT = Math.max(r.width * 0.75, 90); // target orbit radius (px)

    if (dist > OUTER || dist < 1) return null;

    const nx = dx / dist;  // outward unit vector
    const ny = dy / dist;
    const tx = -ny;         // CCW tangential unit vector
    const ty =  nx;

    const disp    = dist - ORBIT;
    const k       = disp > 0 ? 0.18 : 0.54;  // softer outside ring, stiffer inside
    const radial  = -disp * k;
    const tangent = (1 - dist / OUTER) * 1.4;

    return p.createVector(
      nx * radial + tx * tangent,
      ny * radial + ty * tangent,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Flow-direction vector overlay
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Draws a grid of short tick marks showing the instantaneous flow direction —
   * the same angle used to steer particles. Normally invisible (vectorAlpha = 0).
   * @param {object} p - p5 instance
   */
  _drawVectors(p) {
    const CELL = 28;  // grid spacing (px)
    const LEN  = 7;   // half-length of each tick (px)
    const cols = Math.ceil(p.width  / CELL);
    const rows = Math.ceil(p.height / CELL);
    const ns   = this.params.noiseScale;

    p.stroke(...theme.fg, this.params.vectorAlpha);
    p.strokeWeight(0.7);
    p.noFill();

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const x     = c * CELL;
        const y     = r * CELL;
        const angle = p.noise(x * ns, y * ns, this._t) * p.TWO_PI * 2;
        const dx    = Math.cos(angle) * LEN;
        const dy    = Math.sin(angle) * LEN;
        p.line(x - dx, y - dy, x + dx, y + dy);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Contour lines (marching squares)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Draws iso-value contour lines of the current noise field using a lightweight
   * marching-squares pass.
   *
   * Algorithm:
   *   1. Sample p.noise() on a coarse grid into a flat Float32Array (reused per frame).
   *   2. For each iso-level and cell, interpolate crossing points on the four edges.
   *   3. Chain adjacent crossing cells into arcs using a neighbour-walk.
   *   4. Draw each arc as a smooth Catmull-Rom spline.
   *
   * Scratch arrays are pre-allocated on the first call and reused to avoid
   * per-frame GC pressure.
   *
   * @param {object} p - p5 instance
   */
  _drawContours(p) {
    const CELL   = 22;  // grid cell size (px) — coarser = faster, fewer details
    const cols   = Math.ceil(p.width  / CELL);
    const rows   = Math.ceil(p.height / CELL);
    const ns     = this.params.noiseScale;
    const stride = cols + 1;

    // ── 1. sample noise grid ──────────────────────────────────────────────
    if (!this._contourGrid || this._contourGrid.length < (rows + 1) * stride) {
      this._contourGrid = new Float32Array((rows + 1) * stride);
    }
    const grid = this._contourGrid;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        grid[r * stride + c] = p.noise(c * CELL * ns, r * CELL * ns, this._t);
      }
    }

    // ── 2. allocate scratch buffers ───────────────────────────────────────
    const n = rows * cols;
    if (!this._cSeg || this._cSeg.length < n * 4) {
      this._cSeg   = new Float32Array(n * 4);  // [x1,y1,x2,y2] per cell
      this._cHas   = new Uint8Array(n);
      this._cUsed  = new Uint8Array(n);
      this._cFwd   = [];
      this._cBwd   = [];
      this._cChain = [];
    }
    const seg = this._cSeg, has = this._cHas, used = this._cUsed;
    const fwd = this._cFwd, bwd = this._cBwd, chain = this._cChain;

    p.stroke(...theme.fg, this.params.contourAlpha);
    p.strokeWeight(0.6);
    p.noFill();

    // ── 3. per iso-level: build crossings, trace arcs, draw ───────────────

    /**
     * Walks a contour arc from cell (r, c) in the direction exiting through
     * (exX, exY). Follows shared edge-point matches across adjacent cells,
     * marking each visited cell in `used`. Appends exit coordinates to `out`.
     */
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

      // Find edge crossings for this iso-level
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

      // Trace arcs and draw as Catmull-Rom splines
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

        walk(r0, c0, bx, by, fwd);  // extend beyond endpoint B
        walk(r0, c0, ax, ay, bwd);  // extend beyond endpoint A

        // Assemble ordered chain: reversed(bwd) + [A, B] + fwd
        for (let i = bwd.length - 2; i >= 0; i -= 2) chain.push(bwd[i], bwd[i + 1]);
        chain.push(ax, ay, bx, by);
        for (let i = 0; i < fwd.length; i++) chain.push(fwd[i]);

        // Duplicate endpoints so Catmull-Rom passes through first and last points
        p.beginShape();
        p.curveVertex(chain[0], chain[1]);
        for (let i = 0; i < chain.length; i += 2) p.curveVertex(chain[i], chain[i + 1]);
        p.curveVertex(chain[chain.length - 2], chain[chain.length - 1]);
        p.endShape();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Burst-curve overlay — cache + layout
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Pre-computes normalised sample arrays for the four burst-phase curves.
   * Stored as Float32Arrays for efficient per-frame rendering.
   * Results are cached; _drawCurveOverlay triggers a rebuild when the
   * burst-physics cache key changes.
   *
   * Arrays produced:
   *   fieldSamples — flow-field weight (0 → 1)
   *   driftSamples — downward drift, normalised to peak driftStrength
   *   velSamples   — accumulated velocity ratio after applying drag each frame
   *   colorSamples — colorT blend factor (0 = BURST_COLOR, 1 = particleColor)
   */
  _buildCurveSamples() {
    const totalDur   = this.params.burstDur + this.params.floatDur + this.params.returnDur;
    const driftScale = Math.max(this.params.driftStrength, 0.001);  // prevent ÷0

    const fieldSamples = new Float32Array(totalDur);
    const driftSamples = new Float32Array(totalDur);
    const velSamples   = new Float32Array(totalDur);
    const colorSamples = new Float32Array(totalDur);

    let vel = 1.0;  // running velocity ratio (starts at 1, multiplied by drag each frame)
    for (let i = 0; i < totalDur; i++) {
      const phys = this._burstPhysics(i);
      if (phys) {
        fieldSamples[i] = phys.ffWeight;
        driftSamples[i] = phys.drift / driftScale;  // normalised relative to peak
        colorSamples[i] = phys.colorT;
        vel            *= phys.drag;
      }
      velSamples[i] = vel;
    }

    this._curveSamples = { fieldSamples, driftSamples, velSamples, colorSamples };
  }

  /**
   * Computes the pixel-space layout rectangle for the curve overlay panel and
   * returns it as a plain object. Extracted so all drawing sub-methods share a
   * single consistent set of layout constants via one `lo` argument.
   *
   * @param {object} p - p5 instance
   * @returns {{ sc, W, H, ox, oy, CW, CH, cx0, cy0, cx1, cy1, xFloat, xReturn, totalDur, burstDur, floatEnd }}
   */
  _graphLayout(p) {
    const sc = this._graphScale;
    const W  = Math.round(322 * sc);
    const H  = Math.round(190 * sc);
    const MR = 20, MB = 20;  // margin from viewport right / bottom edge
    const ox = p.width  - W - MR;
    const oy = p.height - H - MB;

    const PL = Math.round(42 * sc);  // padding left  (y-axis labels)
    const PR = Math.round(14 * sc);  // padding right
    const PT = Math.round(34 * sc);  // padding top   (header)
    const PB = Math.round(40 * sc);  // padding bottom (legend)

    const CW  = W - PL - PR;    // chart width
    const CH  = H - PT - PB;    // chart height
    const cx0 = ox + PL;        // chart left edge
    const cy0 = oy + PT;        // chart top edge
    const cx1 = cx0 + CW;       // chart right edge
    const cy1 = cy0 + CH;       // chart bottom edge

    const { burstDur, floatDur, returnDur } = this.params;
    const floatEnd = burstDur + floatDur;
    const totalDur = floatEnd + returnDur;
    const xFloat   = cx0 + (burstDur / totalDur) * CW;  // BURST → FLOAT boundary x
    const xReturn  = cx0 + (floatEnd / totalDur) * CW;  // FLOAT → RETURN boundary x

    return { sc, W, H, ox, oy, CW, CH, cx0, cy0, cx1, cy1, xFloat, xReturn, totalDur, burstDur, floatEnd };
  }

  // ── curve plotting helpers ─────────────────────────────────────────────────

  /**
   * Draws a solid continuous curve mapping sample values [0–1] to chart height.
   * @param {object}       p       - p5 instance
   * @param {object}       lo      - layout from _graphLayout()
   * @param {Float32Array} samples
   * @param {number}       alpha   - stroke alpha (0–255)
   * @param {number}       weight  - stroke weight (scaled by lo.sc internally)
   */
  _plotSolid(p, lo, samples, alpha, weight) {
    const { cx0, cy1, CW, CH, totalDur, sc } = lo;
    p.noFill();
    p.stroke(0, 0, 0, alpha);
    p.strokeWeight(weight * sc);
    p.beginShape();
    for (let i = 0; i < totalDur; i++) {
      p.vertex(
        cx0 + (i / (totalDur - 1)) * CW,
        cy1 - Math.max(0, Math.min(1, samples[i])) * CH,
      );
    }
    p.endShape();
  }

  /**
   * Draws a dashed curve with alternating drawn / gap segments.
   * @param {object}       p
   * @param {object}       lo      - layout from _graphLayout()
   * @param {Float32Array} samples
   * @param {number}       alpha
   * @param {number}       weight  - stroke weight (before sc scaling)
   * @param {number}       segLen  - drawn segment length in frames
   * @param {number}       gapLen  - gap length in frames
   */
  _plotSegmented(p, lo, samples, alpha, weight, segLen, gapLen) {
    const { cx0, cy1, CW, CH, totalDur, sc } = lo;
    p.noFill();
    p.stroke(0, 0, 0, alpha);
    p.strokeWeight(weight * sc);
    const cycle = segLen + gapLen;
    let open = false;
    for (let i = 0; i < totalDur; i++) {
      const draw = (i % cycle) < segLen;
      if ( draw && !open) { p.beginShape(); open = true; }
      if (!draw &&  open) { p.endShape();   open = false; }
      if (open) {
        p.vertex(
          cx0 + (i / (totalDur - 1)) * CW,
          cy1 - Math.max(0, Math.min(1, samples[i])) * CH,
        );
      }
    }
    if (open) p.endShape();
  }

  /**
   * Draws a dotted curve whose colour transitions from BURST_COLOR → particleColor,
   * matching the actual particle tint/size transition. Each segment is a single
   * p.line() call so that stroke colour can change per-segment.
   * @param {object}       p
   * @param {object}       lo      - layout from _graphLayout()
   * @param {Float32Array} samples - colorT values [0–1]
   * @param {number}       weight  - stroke weight (before sc scaling)
   * @param {number}       segLen  - dot length in frames
   * @param {number}       gapLen  - gap length in frames
   */
  _plotColorGradient(p, lo, samples, weight, segLen, gapLen) {
    const { cx0, cy1, CW, CH, totalDur, sc } = lo;
    const nc    = this.params.particleColor;
    const cycle = segLen + gapLen;
    p.noFill();
    p.strokeWeight(weight * sc);
    for (let i = 0; i < totalDur - 1; i++) {
      if ((i % cycle) >= segLen) continue;
      const t = samples[i];
      p.stroke(
        Math.round(lerp(BURST_COLOR[0], nc[0], t)),
        Math.round(lerp(BURST_COLOR[1], nc[1], t)),
        Math.round(lerp(BURST_COLOR[2], nc[2], t)),
        210,
      );
      p.line(
        cx0 + (i       / (totalDur - 1)) * CW,
        cy1 - Math.max(0, Math.min(1, samples[i]))     * CH,
        cx0 + ((i + 1) / (totalDur - 1)) * CW,
        cy1 - Math.max(0, Math.min(1, samples[i + 1])) * CH,
      );
    }
  }

  // ── overlay sub-methods (all called within a p.push() block) ──────────────

  /**
   * Draws the decorative chrome: corner accents, header divider, resize handle,
   * header text, phase region shading, grid lines, phase labels, y-axis labels.
   * @param {object} p  - p5 instance
   * @param {object} lo - layout from _graphLayout()
   */
  _drawCurveChrome(p, lo) {
    const { sc, ox, oy, W, H, cx0, cy0, cx1, cy1, CW, CH, xFloat, xReturn, totalDur } = lo;

    // Corner accent marks — machined-panel aesthetic
    const CA = Math.round(9 * sc);
    p.stroke(0, 0, 0, 40);
    p.strokeWeight(0.8 * sc);
    const corners = [
      [ox,     oy,      1,  1],
      [ox + W, oy,     -1,  1],
      [ox,     oy + H,  1, -1],
      [ox + W, oy + H, -1, -1],
    ];
    corners.forEach(([x, y, sx, sy]) => {
      p.line(x, y, x + sx * CA, y);
      p.line(x, y, x,           y + sy * CA);
    });

    // Hairline below header area
    p.stroke(0, 0, 0, 22);
    p.strokeWeight(0.5 * sc);
    p.line(ox + 6, cy0 - Math.round(7 * sc), ox + W - 6, cy0 - Math.round(7 * sc));

    // Resize handle — 2×3 dot grid, top-left corner
    const hx   = ox + Math.round(8 * sc);
    const hy   = oy + Math.round(8 * sc);
    const dotR = 1.5 * sc;
    const dotS = 3.5 * sc;
    p.noStroke();
    p.fill(0, 0, 0, this._graphDragging ? 200 : 90);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        p.ellipse(hx + col * dotS, hy + row * dotS, dotR * 2, dotR * 2);
      }
    }

    // Header
    p.noStroke();
    p.textSize(Math.round(11 * sc));
    p.textAlign(p.LEFT, p.TOP);
    p.fill(0, 0, 0, 210);
    p.text('BURST  CURVES', cx0, oy + Math.round(11 * sc));

    p.textSize(Math.round(7 * sc));
    p.textAlign(p.RIGHT, p.TOP);
    p.fill(0, 0, 0, 60);
    p.text(`t / ${totalDur}`, cx1, oy + Math.round(12 * sc));

    // Float-phase background shading
    p.noStroke();
    p.fill(0, 0, 0, 4);
    p.rect(xFloat, cy0, xReturn - xFloat, CH);

    // Phase labels above chart
    p.textSize(Math.round(7.5 * sc));
    p.textAlign(p.CENTER, p.BOTTOM);
    p.fill(0, 0, 0, 55);
    p.text('· BURST ·',  (cx0     + xFloat)  / 2, cy0 - Math.round(3 * sc));
    p.text('· FLOAT ·',  (xFloat  + xReturn) / 2, cy0 - Math.round(3 * sc));
    p.text('· RETURN ·', (xReturn + cx1)     / 2, cy0 - Math.round(3 * sc));

    // Horizontal grid lines at 0, 0.25, 0.5, 0.75, 1
    p.strokeWeight(0.5 * sc);
    for (let g = 0; g <= 4; g++) {
      const gy = cy1 - g * CH / 4;
      p.stroke(0, 0, 0, g === 0 || g === 4 ? 35 : 14);
      p.line(cx0, gy, cx1, gy);
    }

    // Phase boundary dividers — hand-drawn dotted verticals
    [xFloat, xReturn].forEach(x => {
      for (let dy = cy0; dy < cy1; dy += Math.round(5 * sc)) {
        p.stroke(0, 0, 0, 30);
        p.line(x, dy, x, Math.min(dy + Math.round(2 * sc), cy1));
      }
    });

    // Y-axis labels
    p.noStroke();
    p.textSize(Math.round(8 * sc));
    p.textAlign(p.RIGHT, p.CENTER);
    p.fill(0, 0, 0, 90);
    p.text('1',  cx0 - Math.round(5 * sc), cy0);
    p.text('.5', cx0 - Math.round(5 * sc), cy0 + CH / 2);
    p.text('0',  cx0 - Math.round(5 * sc), cy1);
  }

  /**
   * Draws the animated scan-line playhead if a burst occurred within
   * the last totalDur frames. Shows frame counter and current phase label.
   * @param {object} p  - p5 instance
   * @param {object} lo - layout from _graphLayout()
   */
  _drawCurvePlayhead(p, lo) {
    const { sc, cx0, cy0, cx1, cy1, CW, oy, totalDur } = lo;
    const playFrame = this._frame - this._latestBurstAt;
    if (playFrame < 0 || playFrame >= totalDur) return;

    const phx = cx0 + (playFrame / totalDur) * CW;

    // Scan line + end ticks
    p.stroke(0, 0, 0, 175);
    p.strokeWeight(1 * sc);
    p.line(phx, cy0, phx, cy1);
    p.line(phx - 3 * sc, cy0, phx + 3 * sc, cy0);
    p.line(phx - 3 * sc, cy1, phx + 3 * sc, cy1);

    // Frame counter above the line
    p.noStroke();
    p.textSize(Math.round(8 * sc));
    p.textAlign(p.CENTER, p.BOTTOM);
    p.fill(0, 0, 0, 195);
    p.text(`t = ${playFrame}`, phx, cy0 - Math.round(3 * sc));

    // Phase dot + label, top-right corner
    const phys = this._burstPhysics(playFrame);
    if (phys) {
      p.noStroke();
      p.fill(0, 0, 0, 190);
      p.ellipse(cx1 - 5 * sc, oy + Math.round(13 * sc), 4 * sc, 4 * sc);
      p.textSize(Math.round(8 * sc));
      p.textAlign(p.RIGHT, p.CENTER);
      p.fill(0, 0, 0, 140);
      p.text(phys.phase.toUpperCase(), cx1 - Math.round(13 * sc), oy + Math.round(13 * sc));
    }
  }

  /**
   * Draws the legend strip below the chart. Each entry renders a short sample
   * line in the curve's own visual style, followed by a text label.
   * @param {object} p  - p5 instance
   * @param {object} lo - layout from _graphLayout()
   */
  _drawCurveLegend(p, lo) {
    const { sc, cx0, cy1 } = lo;
    const legY = cy1 + Math.round(19 * sc);
    const nc   = this.params.particleColor;

    p.textSize(Math.round(8 * sc));
    p.textAlign(p.LEFT, p.CENTER);

    const ENTRIES = [
      {
        label: 'FLOW FIELD',
        draw : (x) => {
          p.stroke(0, 0, 0, 195);
          p.strokeWeight(1.8 * sc);
          p.line(x, legY, x + 12 * sc, legY);
        },
      },
      {
        label: 'SPEED',
        draw : (x) => {
          p.stroke(0, 0, 0, 130);
          p.strokeWeight(1.0 * sc);
          p.line(x, legY, x + 12 * sc, legY);
        },
      },
      {
        label: 'DRIFT',
        draw : (x) => {
          p.stroke(0, 0, 0, 100);
          p.strokeWeight(0.8 * sc);
          for (let xi = x; xi < x + 12 * sc; xi += 4 * sc) {
            p.line(xi, legY, Math.min(xi + 2 * sc, x + 12 * sc), legY);
          }
        },
      },
      {
        label: 'TINT + SIZE',
        draw : (x) => {
          p.strokeWeight(1.6 * sc);
          const w = 12 * sc;
          for (let i = 0; i < w; i += 3 * sc) {
            const t = i / w;
            p.stroke(
              Math.round(lerp(BURST_COLOR[0], nc[0], t)),
              Math.round(lerp(BURST_COLOR[1], nc[1], t)),
              Math.round(lerp(BURST_COLOR[2], nc[2], t)),
              220,
            );
            p.line(x + i, legY, Math.min(x + i + 1.5 * sc, x + w), legY);
          }
        },
      },
    ];

    let legX = cx0;
    ENTRIES.forEach(({ label, draw }) => {
      draw(legX);
      p.noStroke();
      p.fill(0, 0, 0, 120);
      p.text(label, legX + 16 * sc, legY);
      legX += 16 * sc + p.textWidth(label) + 10 * sc;
    });
  }

  // ── main overlay entry point ───────────────────────────────────────────────

  /**
   * Top-level method called each frame by the overlay p5 instance.
   * Validates the sample cache, computes the layout, then delegates to
   * focused sub-methods for chrome, curves, playhead, and legend.
   * @param {object} p - p5 instance (transparent overlay canvas)
   */
  _drawCurveOverlay(p) {
    // Rebuild sample cache when any burst-physics param has changed
    const cacheKey = `${this.params.burstDur},${this.params.floatDur},${this.params.returnDur},${this.params.burstDrag},${this.params.floatDrag},${this.params.driftStrength}`;
    if (!this._curveSamples || this._curveSamplesKey !== cacheKey) {
      this._buildCurveSamples();
      this._curveSamplesKey = cacheKey;
    }
    const { fieldSamples, driftSamples, velSamples, colorSamples } = this._curveSamples;

    const lo = this._graphLayout(p);

    p.push();
    p.textFont('Courier New');  // set once; all sub-methods inherit within push/pop

    this._drawCurveChrome(p, lo);

    // Four curves drawn back → front (field on top as the primary signal)
    this._plotSegmented(p,     lo, driftSamples, 100, 0.8, 8, 4);  // dashed  — lightest, back
    this._plotSolid(p,         lo, velSamples,   130, 1.0);         // solid thin
    this._plotColorGradient(p, lo, colorSamples, 1.6, 3, 3);        // dotted gradient
    this._plotSolid(p,         lo, fieldSamples, 200, 1.8);         // solid thick — front, darkest

    this._drawCurvePlayhead(p, lo);
    this._drawCurveLegend(p, lo);

    p.pop();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Resize handle hit test
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if the mouse cursor is over the graph panel's resize handle
   * (the 2×3 dot grid in the top-left corner of the overlay).
   * @param {object} p - p5 instance
   * @returns {boolean}
   */
  _isOnResizeHandle(p) {
    const sc = this._graphScale;
    const W  = Math.round(322 * sc);
    const H  = Math.round(190 * sc);
    const ox = p.width  - W - 20;
    const oy = p.height - H - 20;
    return Math.hypot(p.mouseX - (ox + 8 * sc), p.mouseY - (oy + 8 * sc)) < 14;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Debug panel
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Builds and appends the debug overlay panel and the always-visible ⚙ toggle
   * button to document.body. Wires up slider, reset, and close interactions.
   * The panel starts hidden; call toggleDebug() to show it.
   */
  _initDebugPanel() {
    const panel = document.createElement('div');
    panel.className = 'ff-debug';
    panel.setAttribute('aria-label', 'FlowField debug controls');

    // Build rows from SLIDER_DEFS; section entries become section-header divs
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

    // Persistent ⚙ button (visible even when the panel is closed)
    const btn = document.createElement('button');
    btn.className   = 'ff-debug-toggle';
    btn.title       = 'Toggle debug panel (`)';
    btn.textContent = '⚙';
    btn.addEventListener('click', () => this.toggleDebug());
    document.body.appendChild(btn);
    this._debugToggleBtn = btn;

    // Close button inside the panel header
    panel.querySelector('.ff-debug__close').addEventListener('click', () => this.toggleDebug());

    // Initialise value labels and wire live slider → param sync.
    // Filter out section-header entries (they have no `key`).
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

    // Reset: restore DEFAULTS, keeping showCurves in sync with current panel state
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
