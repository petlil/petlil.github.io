/**
 * FlowField.js
 *
 * Wraps a p5 sketch (instance mode) that renders a full-screen Perlin noise
 * flow field with particles.
 *
 * Usage:
 *   const ff = new FlowField(document.querySelector('#bg'));
 *
 * The `particles` array and `params` object are public — other components
 * may read particle positions or temporarily mutate params.
 *
 * Debug panel: press  `  (backtick) to toggle sliders for all parameters.
 */

import { Particle } from './Particle.js';
import { theme }    from '../core/theme.js';

// Derived from theme — local alias for readability
const BG = theme.bg;

// ─── burst phase constants ─────────────────────────────────────────────────
// A click/tap launches particles outward through three distinct phases:
//   BURST  — pure outburst, strong drag, flowfield silenced
//   FLOAT  — slows, drifts gently downward, flowfield barely audible
//   RETURN — flowfield eases back to full strength

const BURST_DUR  = 22;                           // frames — kept short so float begins while still decelerating
const FLOAT_DUR  = 80;                           // frames
const RETURN_DUR = 120;                          // frames
const TOTAL_DUR  = BURST_DUR + FLOAT_DUR + RETURN_DUR;  // 222

const FLOAT_END  = BURST_DUR + FLOAT_DUR;        // 102
const MAX_DRIFT  = 0.06;                         // peak downward force in float phase

/** Cubic smoothstep — clamps t to [0, 1]. */
function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Linear interpolation. */
function lerp(a, b, t) { return a + (b - a) * t; }

/** Red burst colour — particles tint to this on impact (trail + curve gradient). */
const BURST_COLOR = [220, 65, 45];

/** Gold star colour — drawn on burst particles while they are stars. */
const STAR_COLOR  = [255, 195, 50];

// ─── slider definitions ────────────────────────────────────────────────────
// Each entry drives both the default params and the debug UI.

const SLIDER_DEFS = [
  { key: 'noiseScale',      label: 'Noise scale',    min: 0.0005,  max: 0.012,  step: 0.0001,  decimals: 4 },
  { key: 'noiseSpeed',      label: 'Noise speed',    min: 0.00005, max: 0.002,  step: 0.00005, decimals: 5 },
  { key: 'particleSpeed',   label: 'Speed',          min: 0.5,     max: 12,     step: 0.1,     decimals: 1 },
  { key: 'contourLevels',   label: 'Iso levels',     min: 2,       max: 24,     step: 1,       decimals: 0 },
  // ── burst physics ─────────────────────────────────────────────────────────
  { section: 'Burst physics' },
  { key: 'repulseRadius',   label: 'Radius',         min: 10,      max: 500,    step: 5,       decimals: 0 },
  { key: 'repulseStrength', label: 'Strength',       min: 0,       max: 200,    step: 0.5,     decimals: 1 },
  { key: 'burstDur',        label: 'Burst frames',   min: 5,       max: 60,     step: 1,       decimals: 0 },
  { key: 'floatDur',        label: 'Float frames',   min: 10,      max: 200,    step: 5,       decimals: 0 },
  { key: 'returnDur',       label: 'Return frames',  min: 20,      max: 300,    step: 5,       decimals: 0 },
  { key: 'burstDrag',       label: 'Burst drag',     min: 0.75,    max: 0.99,   step: 0.01,    decimals: 2 },
  { key: 'floatDrag',       label: 'Float drag',     min: 0.90,    max: 1.00,   step: 0.005,   decimals: 3 },
  { key: 'driftStrength',   label: 'Drift strength', min: 0,       max: 0.30,   step: 0.005,   decimals: 3 },
];

// ─── defaults ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  particleCount:   500,
  noiseScale:      0.0028,
  noiseSpeed:      0.00035,
  particleSpeed:   4.7,
  trailAlpha:      60,             // background fade per frame — lower = longer trails
  particleAlpha:   140,            // particle stroke alpha (0–255)
  particleSize:    1.0,            // stroke weight in pixels
  particleColor:   theme.particle, // [r, g, b] — set to any theme colour or custom
  contourAlpha:    15,             // opacity of iso-contour lines (0 = off)
  contourLevels:   30,             // number of iso-value lines drawn
  vectorAlpha:     0,              // opacity of flow-direction tick marks (0 = off)
  repulseRadius:   180,            // click/tap explosion radius in pixels
  repulseStrength: 10,             // click/tap burst impulse strength
  showCurves:      false,          // debug: draw burst-phase transition curves
  // ── burst physics ──────────────────────────────────────────────────────────
  burstDur:        22,             // frames — outburst phase
  floatDur:        80,             // frames — float / drift phase
  returnDur:       120,            // frames — flow-field return phase
  burstDrag:       0.88,           // initial drag during burst (increases to +0.06 by end)
  floatDrag:       0.96,           // initial drag during float (increases to +0.03 via smoothstep)
  driftStrength:   0.06,           // peak downward drift force during float
};

// ─── FlowField ────────────────────────────────────────────────────────────

export class FlowField {
  /**
   * @param {HTMLElement} containerEl - element to mount the canvas into
   * @param {object}      [options]   - override any DEFAULTS
   */
  constructor(containerEl, options = {}) {
    this.container = containerEl;

    /** Live params — mutate at will; the sketch reads these every frame. */
    this.params = { ...DEFAULTS, ...options };

    /**
     * Particle collection. Other components may iterate this array to read
     * positions, velocities, etc. Do not replace the array reference — only
     * mutate its contents.
     */
    this.particles = [];

    this._t             = 0;       // noise time offset (advances with noiseSpeed)
    this._frame         = 0;       // global frame counter
    this._sketch        = null;
    this._debugPanel    = null;
    this._debugVisible  = false;
    this._hoverRect     = null;    // DOMRect of the currently selected nav item
    this._latestBurstAt  = -9999;  // frame when the last burst was fired
    this._curveSamples   = null;   // lazy-built; rebuild if BURST_DUR changes
    this._graphScale     = 1.0;   // resize handle scale (0.5 – 2.5)
    this._graphDragging  = false;
    this._dragStartX     = 0;
    this._dragStartY     = 0;
    this._dragStartScale = 1.0;
    this._overlaySketch  = null;  // separate p5 instance for the curve overlay

    this._initSketch();
    this._initOverlaySketch();
    this._initDebugPanel();

    // Global key listener so the toggle works regardless of canvas focus
    this._onKey = (e) => { if (e.key === '`') this.toggleDebug(); };
    window.addEventListener('keydown', this._onKey);
  }

  // ─── burst physics ─────────────────────────────────────────────────────

  /**
   * Returns per-frame physics parameters for a burst particle at `frame`.
   * @param {number} frame - frames elapsed since burst was applied
   * @returns {{ phase: string, ffWeight: number, drag: number, drift: number } | null}
   *   null signals the burst has fully completed.
   */
  _burstPhysics(frame) {
    // Derive phase boundaries from live params so sliders take effect immediately
    const BURST_DUR  = this.params.burstDur;
    const FLOAT_DUR  = this.params.floatDur;
    const RETURN_DUR = this.params.returnDur;
    const TOTAL_DUR  = BURST_DUR + FLOAT_DUR + RETURN_DUR;
    const FLOAT_END  = BURST_DUR + FLOAT_DUR;
    const MAX_DRIFT  = this.params.driftStrength;
    const BURST_DRAG = this.params.burstDrag;
    const FLOAT_DRAG = this.params.floatDrag;

    if (frame >= TOTAL_DUR) return null;

    if (frame < BURST_DUR) {
      // Phase 1 — pure outburst
      const t = frame / BURST_DUR;
      return {
        phase    : 'burst',
        ffWeight : 0,
        drag     : BURST_DRAG + t * 0.06,
        drift    : 0,
        colorT   : 0,
      };
    }

    if (frame < FLOAT_END) {
      // Phase 2 — floating
      const t = (frame - BURST_DUR) / FLOAT_DUR;
      return {
        phase    : 'float',
        ffWeight : 0.04,
        drag     : FLOAT_DRAG + smoothstep(t) * 0.03,
        drift    : MAX_DRIFT * Math.sin(t * Math.PI),
        colorT   : smoothstep(t) * 0.35,
      };
    }

    // Phase 3 — return
    const t = (frame - FLOAT_END) / RETURN_DUR;
    const ss = smoothstep(t);
    return {
      phase    : 'return',
      ffWeight : 0.04 + ss * 0.96,
      drag     : 1.0,
      drift    : 0,
      colorT   : 0.35 + ss * ss * 0.65,
    };
  }

  /**
   * Kicks all particles within repulseRadius into burst state.
   * @param {object} p  - p5 instance
   * @param {number} cx - click x
   * @param {number} cy - click y
   */
  _applyBurst(p, cx, cy) {
    const R = this.params.repulseRadius;
    const S = this.params.repulseStrength;
    if (S <= 0) return;

    for (const pt of this.particles) {
      const dx   = pt.pos.x - cx;
      const dy   = pt.pos.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < R && dist > 1) {
        const scale  = S * (1 - dist / R);
        // Set velocity directly — clean outburst, not additive
        pt.vel.x     = (dx / dist) * scale;
        pt.vel.y     = (dy / dist) * scale;
        pt.acc.set(0, 0);              // discard any pending forces
        pt.burstState = {
          frame    : 0,
          heading  : Math.atan2(dy, dx),          // lock star orientation to launch direction
          burstDur : this.params.burstDur,
          floatDur : this.params.floatDur,
          returnDur: this.params.returnDur,
        };
      }
    }
    this._latestBurstAt = this._frame;
  }

  // ─── star rendering ───────────────────────────────────────────────────────

  /**
   * Draws a 5-pointed star at `pt.pos`, sized and coloured from burst overrides.
   * One point faces the direction of travel for a dynamic feel.
   * @param {object}   p  - p5 instance
   * @param {Particle} pt - the particle to draw
   */
  _drawStar(p, pt) {
    // Use snapshotted durations so mid-burst param changes don't glitch the animation
    const frame    = pt.burstState.frame;
    const burstDur = pt.burstState.burstDur;
    const floatEnd = burstDur + pt.burstState.floatDur;
    const totalDur = floatEnd + pt.burstState.returnDur;
    const returnDur = pt.burstState.returnDur;

    const size = pt._sizeOverride ?? this.params.particleSize;
    const maxR = size * 4;   // peak outer radius

    let R, ri;

    if (frame < burstDur) {
      // Pop in: 0 → full over the burst phase
      const expandT = smoothstep(frame / burstDur);
      R  = maxR * expandT;
      ri = R * 0.4;
    } else {
      // Shrink immediately after burst ends, through float + return
      const shrinkT = smoothstep((frame - burstDur) / (totalDur - burstDur));
      R  = maxR * (1 - shrinkT * 0.9);
      // Morph star → circle during return phase
      const morphT = frame > floatEnd
        ? smoothstep((frame - floatEnd) / returnDur)
        : 0;
      ri = R * lerp(0.4, 1.0, morphT);
    }

    // Compute colorT — mirrors _burstPhysics but uses snapshotted durations
    let colorT = 0;
    if (frame >= burstDur) {
      if (frame < floatEnd) {
        colorT = smoothstep((frame - burstDur) / pt.burstState.floatDur) * 0.35;
      } else {
        const tt = (frame - floatEnd) / returnDur;
        const ss = smoothstep(tt);
        colorT = 0.35 + ss * ss * 0.65;
      }
    }
    // Lerp star from gold → particle colour as colorT approaches 1
    const nc = this.params.particleColor;
    const drawColor = [
      Math.round(lerp(STAR_COLOR[0], nc[0], colorT)),
      Math.round(lerp(STAR_COLOR[1], nc[1], colorT)),
      Math.round(lerp(STAR_COLOR[2], nc[2], colorT)),
    ];

    // Same fade envelope as Particle.draw()
    const fadeIn  = Math.min(pt.age / 60, 1);
    const fadeOut = Math.min((pt.lifespan - pt.age) / 60, 1);
    const alpha   = Math.min(fadeIn, fadeOut) * this.params.particleAlpha;

    // Locked orientation — captured at burst start, doesn't drift with velocity
    const heading = pt.burstState.heading;

    p.push();
    p.translate(pt.pos.x, pt.pos.y);
    p.rotate(heading);

    p.fill(...drawColor, alpha * 0.7);
    p.stroke(...drawColor, alpha);
    p.strokeWeight(0.5);

    p.beginShape();
    for (let i = 0; i < 10; i++) {
      const a   = (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R : ri;
      p.vertex(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    p.endShape(p.CLOSE);

    p.pop();
  }

  // ─── p5 sketch ────────────────────────────────────────────────────────────

  _initSketch() {
    this._sketch = new p5((p) => {

      p.setup = () => {
        const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
        cnv.style('display', 'block');
        p.background(...BG);

        // Seed the particle pool
        for (let i = 0; i < this.params.particleCount; i++) {
          this.particles.push(new Particle(p, this.params));
        }
      };

      p.draw = () => {
        // Semi-transparent overlay creates motion trails.
        p.noStroke();
        p.fill(...BG, this.params.trailAlpha);
        p.rect(0, 0, p.width, p.height);

        // Advance noise time and frame counter
        this._t += this.params.noiseSpeed;
        this._frame++;

        // Optional debug overlays
        if (this.params.vectorAlpha  > 0) this._drawVectors(p);
        if (this.params.contourAlpha > 0) this._drawContours(p);

        // Maintain particle count dynamically
        while (this.particles.length < this.params.particleCount) {
          this.particles.push(new Particle(p, this.params));
        }
        while (this.particles.length > this.params.particleCount) {
          this.particles.pop();
        }

        // Update + draw every particle
        for (let i = 0; i < this.particles.length; i++) {
          const pt = this.particles[i];

          // Flowfield vector at this position — computed for every particle,
          // applied at full or partial weight depending on burst state.
          const nx    = pt.pos.x * this.params.noiseScale;
          const ny    = pt.pos.y * this.params.noiseScale;
          const angle = p.noise(nx, ny, this._t) * p.TWO_PI * 2;
          const ffx   = Math.cos(angle) * 0.8;
          const ffy   = Math.sin(angle) * 0.8;

          if (pt.burstState) {
            const phys = this._burstPhysics(pt.burstState.frame);

            if (!phys) {
              // Burst complete — clear and fall through to normal physics
              pt.burstState     = null;
              pt._colorOverride = undefined;
              pt._sizeOverride  = undefined;

            } else {
              const { phase, ffWeight, drag, drift, colorT } = phys;

              // Colour + size — tint red on burst, return with colorT curve
              const nc = this.params.particleColor;
              pt._colorOverride = [
                Math.round(lerp(BURST_COLOR[0], nc[0], colorT)),
                Math.round(lerp(BURST_COLOR[1], nc[1], colorT)),
                Math.round(lerp(BURST_COLOR[2], nc[2], colorT)),
              ];
              pt._sizeOverride = lerp(this.params.particleSize * 2.5, this.params.particleSize, colorT);

              // Scaled flowfield
              if (ffWeight > 0) {
                pt.applyForce(p.createVector(ffx * ffWeight, ffy * ffWeight));
              }

              // Downward drift (replaces gravity during float)
              if (drift > 0) {
                pt.applyForce(p.createVector(0, drift));
              }

              // Apply drag by scaling velocity directly, before update
              pt.vel.x *= drag;
              pt.vel.y *= drag;

              if (phase === 'burst') {
                // Manual update: bypass vel.limit so the outburst isn't clamped.
                // By the end of the burst phase drag has reduced velocity well
                // below particleSpeed, so normal limiting is safe from float onward.
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

          // Normal physics — runs for non-burst particles, and on the frame
          // a burst ends (burstState was just set to null above).
          if (!pt.burstState) {
            pt.applyForce(p.createVector(ffx, ffy));
            const orb = this._orbit(p, pt.pos.x, pt.pos.y);
            if (orb) pt.applyForce(orb);
            pt.update();
          }

          if (pt.burstState) {
            this._drawStar(p, pt);
          } else {
            pt.draw();
          }

          if (pt.isDead()) {
            pt.burstState     = null;
            pt._colorOverride = undefined;
            pt._sizeOverride  = undefined;
            pt.reset();
          }
        }

        // Curve overlay is drawn by a separate p5 instance (_overlaySketch)
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        p.background(...BG);
      };

      p.mousePressed = (e) => {
        if (e && e.target !== p.canvas) return;
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
        // Top-left handle: drag left/up = bigger, right/down = smaller
        const delta = (this._dragStartX - p.mouseX + this._dragStartY - p.mouseY) * 0.003;
        this._graphScale = Math.max(0.5, Math.min(2.5, this._dragStartScale + delta));
      };

      p.mouseReleased = () => {
        this._graphDragging = false;
      };

      p.touchStarted = (e) => {
        if (e && e.target !== p.canvas) return;
        if (p.touches.length > 0) {
          this._applyBurst(p, p.touches[0].x, p.touches[0].y);
        }
        return false;
      };

    }, this.container);
  }

  // ─── overlay sketch (curve panel on its own transparent canvas) ────────────

  /**
   * Creates a second p5 instance whose canvas sits above the main canvas but
   * still within #bg's stacking context (so below nav/content/debug).
   * `clear()` each frame keeps it free of trail-fade artefacts.
   */
  _initOverlaySketch() {
    this._overlaySketch = new p5((p) => {
      p.setup = () => {
        const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
        cnv.style('position', 'absolute');
        cnv.style('top', '0');
        cnv.style('left', '0');
        cnv.style('pointer-events', 'none');
        p.clear();
      };

      p.draw = () => {
        p.clear();
        if (this.params.showCurves) this._drawCurveOverlay(p);
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };
    }, this.container);
  }

  // ─── public API ───────────────────────────────────────────────────────────

  /**
   * Set the bounding rect of a DOM element that particles should orbit.
   * Pass null to clear the effect.
   * @param {DOMRect|null} rect
   */
  setHoverRect(rect) {
    this._hoverRect = rect;
  }

  // ─── particle orbit ───────────────────────────────────────────────────────

  /**
   * Returns a force that pulls particles toward an orbit ring around the
   * hovered nav element and sets them circling counter-clockwise.
   *
   * Two components act together every frame:
   *   • Radial spring — attractive when dist > ORBIT, repulsive when < ORBIT,
   *     zero exactly on the ring.  Strength scales with displacement.
   *   • CCW tangential — perpendicular to the outward radial, strongest near
   *     the element and tapering to zero at OUTER (the influence boundary).
   *
   * @param {object} p  - p5 instance
   * @param {number} px - particle x
   * @param {number} py - particle y
   * @returns {p5.Vector|null}
   */
  _orbit(p, px, py) {
    const r = this._hoverRect;
    if (!r) return null;

    // Centre of the hovered word
    const cx = (r.left + r.right)  / 2;
    const cy = (r.top  + r.bottom) / 2;
    const dx = px - cx, dy = py - cy;
    const dist = Math.hypot(dx, dy);

    // Outer influence radius — beyond this, no force at all
    const OUTER = 300;
    // Orbit radius — the ring particles settle onto
    const ORBIT = Math.max(r.width * 0.75, 90);

    if (dist > OUTER || dist < 1) return null;

    // Outward unit vector from centre to particle
    const nx = dx / dist, ny = dy / dist;
    // CCW tangential unit vector (rotate outward 90° CCW)
    const tx = -ny, ty = nx;

    // Radial spring: pulls in hard from far away, strongly resists going inside
    // Higher k = snappier spring; asymmetry (×3 inside) keeps the ring crisp
    const disp    = dist - ORBIT;
    const k       = disp > 0 ? 0.18 : 0.54; // stiffer when inside the ring
    const radial  = -disp * k;
    // Tangential: strong near the word, fades to zero at OUTER
    const tangent = (1 - dist / OUTER) * 1.4;

    return p.createVector(
      nx * radial + tx * tangent,
      ny * radial + ty * tangent,
    );
  }

  // ─── flow-direction vectors ───────────────────────────────────────────────

  /**
   * Draws a coarse grid of short tick marks showing the instantaneous
   * flow direction at each point — the same angle used to steer particles.
   * @param {object} p - p5 instance
   */
  _drawVectors(p) {
    const CELL   = 28;       // grid spacing in pixels
    const LEN    = 7;        // half-length of each tick mark
    const cols   = Math.ceil(p.width  / CELL);
    const rows   = Math.ceil(p.height / CELL);
    const ns     = this.params.noiseScale;

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

  // ─── contour lines (marching squares) ────────────────────────────────────

  /**
   * Draws iso-value contour lines of the current noise field using a
   * simplified marching-squares pass.
   *
   * Strategy:
   *   1. Sample p.noise() on a coarse grid (one pass, cached per frame).
   *   2. For each cell and each iso-level, find where the level crosses
   *      the cell's four edges and draw a line segment between crossings.
   *
   * @param {object} p - p5 instance
   */
  _drawContours(p) {
    const CELL = 22; // grid cell size in pixels
    const cols = Math.ceil(p.width  / CELL);
    const rows = Math.ceil(p.height / CELL);
    const ns   = this.params.noiseScale;

    // ── 1. build noise grid ──────────────────────────────────────────────
    // Reuse a flat Float32Array to avoid per-frame allocations.
    const stride = cols + 1;
    if (!this._contourGrid || this._contourGrid.length < (rows + 1) * stride) {
      this._contourGrid = new Float32Array((rows + 1) * stride);
    }
    const grid = this._contourGrid;

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        grid[r * stride + c] = p.noise(c * CELL * ns, r * CELL * ns, this._t);
      }
    }

    // ── 2. draw contours ─────────────────────────────────────────────────
    p.stroke(...theme.fg, this.params.contourAlpha);
    p.strokeWeight(0.6);
    p.noFill();

    const levels = this.params.contourLevels;
    const n      = rows * cols;

    // Scratch buffers — allocated once, reused every frame.
    if (!this._cSeg || this._cSeg.length < n * 4) {
      this._cSeg   = new Float32Array(n * 4); // [x1,y1,x2,y2] per cell
      this._cHas   = new Uint8Array(n);
      this._cUsed  = new Uint8Array(n);
      this._cFwd   = [];
      this._cBwd   = [];
      this._cChain = [];
    }
    const seg = this._cSeg, has = this._cHas, used = this._cUsed;
    const fwd = this._cFwd, bwd = this._cBwd, chain = this._cChain;

    // Walk from cell (r,c) following the contour arc via shared edge points.
    // Appends newly-visited points to `out`; stops when no unvisited neighbour
    // shares the current exit coordinate (exX, exY).
    const walk = (startR, startC, exX, exY, out) => {
      let r = startR, c = startC;
      while (true) {
        let moved = false;
        for (let d = 0; d < 4; d++) {
          const nr = r + (d === 0 ? -1 : d === 1 ? 1 : 0);
          const nc = c + (d === 2 ? -1 : d === 3 ? 1 : 0);
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const ni = nr * cols + nc;
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

    for (let li = 1; li <= levels; li++) {
      const L = li / (levels + 1);

      // Build crossing table for this iso-level.
      has.fill(0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tl = grid[r       * stride + c    ];
          const tr = grid[r       * stride + c + 1];
          const br = grid[(r + 1) * stride + c + 1];
          const bl = grid[(r + 1) * stride + c    ];
          const x0 = c * CELL, y0 = r * CELL;
          const pts = [];
          if ((tl-L)*(tr-L) < 0) { const t=(L-tl)/(tr-tl); pts.push(x0+t*CELL, y0); }
          if ((tr-L)*(br-L) < 0) { const t=(L-tr)/(br-tr); pts.push(x0+CELL, y0+t*CELL); }
          if ((bl-L)*(br-L) < 0) { const t=(L-bl)/(br-bl); pts.push(x0+t*CELL, y0+CELL); }
          if ((tl-L)*(bl-L) < 0) { const t=(L-tl)/(bl-tl); pts.push(x0, y0+t*CELL); }
          if (pts.length >= 4) {
            const i4 = (r * cols + c) << 2;
            seg[i4] = pts[0]; seg[i4+1] = pts[1];
            seg[i4+2] = pts[2]; seg[i4+3] = pts[3];
            has[r * cols + c] = 1;
          }
        }
      }

      // Trace each arc and draw as a smooth Catmull-Rom spline.
      used.fill(0);
      for (let start = 0; start < n; start++) {
        if (!has[start] || used[start]) continue;
        used[start] = 1;
        const r0 = (start / cols) | 0, c0 = start % cols;
        const i4  = start << 2;
        const ax  = seg[i4], ay = seg[i4+1], bx = seg[i4+2], by = seg[i4+3];

        // Extend in both directions from this seed cell.
        fwd.length = 0; bwd.length = 0; chain.length = 0;
        walk(r0, c0, bx, by, fwd); // extend past B
        walk(r0, c0, ax, ay, bwd); // extend past A

        // Assemble ordered chain: reversed(bwd) + [A,B] + fwd
        for (let i = bwd.length - 2; i >= 0; i -= 2) chain.push(bwd[i], bwd[i+1]);
        chain.push(ax, ay, bx, by);
        for (let i = 0; i < fwd.length; i++) chain.push(fwd[i]);

        // Draw as Catmull-Rom; duplicate end-points serve as control points.
        p.beginShape();
        p.curveVertex(chain[0], chain[1]);
        for (let i = 0; i < chain.length; i += 2) p.curveVertex(chain[i], chain[i+1]);
        p.curveVertex(chain[chain.length-2], chain[chain.length-1]);
        p.endShape();
      }
    }
  }

  // ─── burst curve overlay ──────────────────────────────────────────────────

  /**
   * Lazily builds and caches the static curve sample arrays.
   * All three curves are deterministic (no runtime params), so this only
   * runs once per FlowField instance.
   */
  _buildCurveSamples() {
    const totalDur    = this.params.burstDur + this.params.floatDur + this.params.returnDur;
    const driftScale  = Math.max(this.params.driftStrength, 0.001); // guard against /0

    const fieldSamples = new Float32Array(totalDur);
    const driftSamples = new Float32Array(totalDur);
    const velSamples   = new Float32Array(totalDur);
    const colorSamples = new Float32Array(totalDur);

    let vel = 1.0;
    for (let i = 0; i < totalDur; i++) {
      const phys = this._burstPhysics(i);
      if (phys) {
        fieldSamples[i] = phys.ffWeight;
        driftSamples[i] = phys.drift / driftScale;  // normalised 0–1
        colorSamples[i] = phys.colorT;
        vel            *= phys.drag;
      }
      velSamples[i] = vel;
    }

    this._curveSamples = { fieldSamples, driftSamples, velSamples, colorSamples };
  }

  /**
   * Draws the burst-phase transition curve overlay onto the canvas.
   * Transparent background; all lines and text in black; scales with _graphScale.
   * Drag handle (2×3 dot grid) at top-left corner resizes the panel.
   * @param {object} p - p5 instance
   */
  _drawCurveOverlay(p) {
    // Rebuild curve cache whenever burst physics params change
    const cacheKey = `${this.params.burstDur},${this.params.floatDur},${this.params.returnDur},${this.params.burstDrag},${this.params.floatDrag},${this.params.driftStrength}`;
    if (!this._curveSamples || this._curveSamplesKey !== cacheKey) {
      this._buildCurveSamples();
      this._curveSamplesKey = cacheKey;
    }
    const { fieldSamples, driftSamples, velSamples, colorSamples } = this._curveSamples;

    // Phase boundaries from live params (shadow the module-level constants)
    const BURST_DUR = this.params.burstDur;
    const FLOAT_END = this.params.burstDur + this.params.floatDur;
    const TOTAL_DUR = FLOAT_END + this.params.returnDur;

    // ── layout ────────────────────────────────────────────────────────────
    const sc = this._graphScale;
    const W  = Math.round(322 * sc);
    const H  = Math.round(190 * sc);
    const MR = 20, MB = 20;
    const ox = p.width  - W - MR;
    const oy = p.height - H - MB;

    const PL = Math.round(42 * sc), PR = Math.round(14 * sc);
    const PT = Math.round(34 * sc), PB = Math.round(40 * sc);
    const CW = W - PL - PR;
    const CH = H - PT - PB;
    const cx0 = ox + PL;
    const cy0 = oy + PT;
    const cx1 = cx0 + CW;
    const cy1 = cy0 + CH;

    const xFloat  = cx0 + (BURST_DUR / TOTAL_DUR) * CW;
    const xReturn = cx0 + (FLOAT_END / TOTAL_DUR) * CW;

    p.push();
    p.textFont('Courier New');

    // ── corner accent marks — machined-panel aesthetic ─────────────────────
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
      p.line(x, y, x, y + sy * CA);
    });

    // Divider line below header
    p.stroke(0, 0, 0, 22);
    p.strokeWeight(0.5 * sc);
    p.line(ox + 6, cy0 - Math.round(7 * sc), ox + W - 6, cy0 - Math.round(7 * sc));

    // ── resize handle — 2×3 dot grid, top-left corner ─────────────────────
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

    // ── header ────────────────────────────────────────────────────────────
    p.noStroke();
    p.textSize(Math.round(11 * sc));
    p.textAlign(p.LEFT, p.TOP);
    p.fill(0, 0, 0, 210);
    p.text('BURST  CURVES', cx0, oy + Math.round(11 * sc));

    p.textSize(Math.round(7 * sc));
    p.textAlign(p.RIGHT, p.TOP);
    p.fill(0, 0, 0, 60);
    p.text(`t / ${TOTAL_DUR}`, cx1, oy + Math.round(12 * sc));

    // ── phase regions ─────────────────────────────────────────────────────
    p.noStroke();
    p.fill(0, 0, 0, 4);
    p.rect(xFloat, cy0, xReturn - xFloat, CH);

    // Phase labels above chart
    p.textSize(Math.round(7.5 * sc));
    p.textAlign(p.CENTER, p.BOTTOM);
    p.fill(0, 0, 0, 55);
    p.text('· BURST ·',  (cx0    + xFloat)  / 2, cy0 - Math.round(3 * sc));
    p.text('· FLOAT ·',  (xFloat + xReturn) / 2, cy0 - Math.round(3 * sc));
    p.text('· RETURN ·', (xReturn + cx1)    / 2, cy0 - Math.round(3 * sc));

    // ── grid ──────────────────────────────────────────────────────────────
    p.strokeWeight(0.5 * sc);
    for (let g = 0; g <= 4; g++) {
      const gy = cy1 - g * CH / 4;
      p.stroke(0, 0, 0, g === 0 || g === 4 ? 35 : 14);
      p.line(cx0, gy, cx1, gy);
    }

    // Phase dividers — dotted vertical
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

    // ── curve helpers ─────────────────────────────────────────────────────

    const solid = (samples, alpha, weight) => {
      p.noFill();
      p.stroke(0, 0, 0, alpha);
      p.strokeWeight(weight * sc);
      p.beginShape();
      for (let i = 0; i < TOTAL_DUR; i++) {
        p.vertex(cx0 + (i / (TOTAL_DUR - 1)) * CW,
                 cy1 - Math.max(0, Math.min(1, samples[i])) * CH);
      }
      p.endShape();
    };

    const segmented = (samples, alpha, weight, segLen, gapLen) => {
      p.noFill();
      p.stroke(0, 0, 0, alpha);
      p.strokeWeight(weight * sc);
      const cycle = segLen + gapLen;
      let open = false;
      for (let i = 0; i < TOTAL_DUR; i++) {
        const draw = (i % cycle) < segLen;
        if (draw && !open)  { p.beginShape(); open = true; }
        if (!draw && open)  { p.endShape();   open = false; }
        if (open) {
          p.vertex(cx0 + (i / (TOTAL_DUR - 1)) * CW,
                   cy1 - Math.max(0, Math.min(1, samples[i])) * CH);
        }
      }
      if (open) p.endShape();
    };

    // Color-gradient dotted curve for TINT + SIZE — lerps BURST_COLOR → particleColor
    const colorGradient = (samples, weight, segLen, gapLen) => {
      const nc = this.params.particleColor;
      p.strokeWeight(weight * sc);
      p.noFill();
      const cycle = segLen + gapLen;
      for (let i = 0; i < TOTAL_DUR - 1; i++) {
        if ((i % cycle) >= segLen) continue;
        const t = samples[i];
        p.stroke(
          Math.round(lerp(BURST_COLOR[0], nc[0], t)),
          Math.round(lerp(BURST_COLOR[1], nc[1], t)),
          Math.round(lerp(BURST_COLOR[2], nc[2], t)),
          210,
        );
        p.line(
          cx0 + (i / (TOTAL_DUR - 1)) * CW,
          cy1 - Math.max(0, Math.min(1, samples[i])) * CH,
          cx0 + ((i + 1) / (TOTAL_DUR - 1)) * CW,
          cy1 - Math.max(0, Math.min(1, samples[i + 1])) * CH,
        );
      }
    };

    // Draw order: back to front
    segmented(driftSamples, 100, 0.8, 8, 4);    // dashed — lightest, back
    solid(velSamples,       130, 1.0);            // solid thin — secondary
    colorGradient(colorSamples, 1.6, 3, 3);       // dotted gradient — BURST_COLOR → normal
    solid(fieldSamples,     200, 1.8);            // solid thick — front, darkest

    // ── playhead ──────────────────────────────────────────────────────────
    const playFrame = this._frame - this._latestBurstAt;
    if (playFrame >= 0 && playFrame < TOTAL_DUR) {
      const phx = cx0 + (playFrame / TOTAL_DUR) * CW;

      p.stroke(0, 0, 0, 175);
      p.strokeWeight(1 * sc);
      p.line(phx, cy0, phx, cy1);
      p.line(phx - 3 * sc, cy0, phx + 3 * sc, cy0);
      p.line(phx - 3 * sc, cy1, phx + 3 * sc, cy1);

      p.noStroke();
      p.textSize(Math.round(8 * sc));
      p.textAlign(p.CENTER, p.BOTTOM);
      p.fill(0, 0, 0, 195);
      p.text(`t = ${playFrame}`, phx, cy0 - Math.round(3 * sc));

      // Phase label — top-right corner
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

    // ── legend ────────────────────────────────────────────────────────────
    const legY = cy1 + Math.round(19 * sc);
    p.textSize(Math.round(8 * sc));
    p.textAlign(p.LEFT, p.CENTER);
    const LEGEND = [
      {
        label: 'FLOW FIELD',
        draw : (x) => { p.stroke(0,0,0,195); p.strokeWeight(1.8*sc); p.line(x, legY, x + 12*sc, legY); },
      },
      {
        label: 'SPEED',
        draw : (x) => { p.stroke(0,0,0,130); p.strokeWeight(1.0*sc); p.line(x, legY, x + 12*sc, legY); },
      },
      {
        label: 'DRIFT',
        draw : (x) => {
          p.stroke(0,0,0,100); p.strokeWeight(0.8*sc);
          for (let xi = x; xi < x + 12*sc; xi += 4*sc) p.line(xi, legY, Math.min(xi + 2*sc, x + 12*sc), legY);
        },
      },
      {
        label: 'TINT + SIZE',
        draw : (x) => {
          const nc = this.params.particleColor;
          p.strokeWeight(1.6*sc);
          const w = 12 * sc;
          for (let i = 0; i < w; i += 3*sc) {
            const t = i / w;
            p.stroke(
              Math.round(lerp(BURST_COLOR[0], nc[0], t)),
              Math.round(lerp(BURST_COLOR[1], nc[1], t)),
              Math.round(lerp(BURST_COLOR[2], nc[2], t)),
              220,
            );
            p.line(x + i, legY, Math.min(x + i + 1.5*sc, x + w), legY);
          }
        },
      },
    ];
    let legX = cx0;
    LEGEND.forEach(({ label, draw }) => {
      draw(legX);
      p.noStroke();
      p.fill(0, 0, 0, 120);
      p.text(label, legX + 16 * sc, legY);
      legX += 16 * sc + p.textWidth(label) + 10 * sc;
    });

    p.pop();
  }

  // ─── resize handle hit test ────────────────────────────────────────────────

  _isOnResizeHandle(p) {
    const sc = this._graphScale;
    const W  = Math.round(322 * sc);
    const H  = Math.round(190 * sc);
    const ox = p.width  - W - 20;
    const oy = p.height - H - 20;
    return Math.hypot(p.mouseX - (ox + 8 * sc), p.mouseY - (oy + 8 * sc)) < 14;
  }

  // ─── debug panel ──────────────────────────────────────────────────────────

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
      <div class="ff-debug__divider"></div>
      <label class="ff-debug__row ff-debug__row--check">
        <span class="ff-debug__label">Burst curves</span>
        <input type="checkbox" class="ff-debug__check" data-param="showCurves">
        <span class="ff-debug__value ff-debug__value--check"></span>
      </label>
      <button class="ff-debug__reset">Reset</button>
    `;

    panel.style.display = 'none';
    document.body.appendChild(panel);
    this._debugPanel = panel;

    // Always-visible toggle button so the panel can be opened without keyboard
    const btn = document.createElement('button');
    btn.className = 'ff-debug-toggle';
    btn.title = 'Toggle debug panel (`)';
    btn.textContent = '⚙';
    btn.addEventListener('click', () => this.toggleDebug());
    document.body.appendChild(btn);
    this._debugToggleBtn = btn;

    // Close button inside the panel header
    panel.querySelector('.ff-debug__close').addEventListener('click', () => this.toggleDebug());

    // Initialise value labels and wire up sliders (skip section header entries)
    SLIDER_DEFS.filter(d => d.key).forEach(({ key, decimals }) => {
      const slider  = panel.querySelector(`input[data-param="${key}"]`);
      const valueEl = panel.querySelector(`[data-value="${key}"]`);

      valueEl.textContent = Number(this.params[key]).toFixed(decimals);

      slider.addEventListener('input', () => {
        const val           = parseFloat(slider.value);
        this.params[key]    = val;
        valueEl.textContent = val.toFixed(decimals);
      });
    });

    // Burst curves checkbox
    const cb = panel.querySelector('input[data-param="showCurves"]');
    cb.checked = this.params.showCurves;
    cb.addEventListener('change', () => {
      this.params.showCurves = cb.checked;
    });

    // Reset button
    panel.querySelector('.ff-debug__reset').addEventListener('click', () => {
      Object.assign(this.params, DEFAULTS);
      SLIDER_DEFS.filter(d => d.key).forEach(({ key, decimals }) => {
        const slider  = panel.querySelector(`input[data-param="${key}"]`);
        const valueEl = panel.querySelector(`[data-value="${key}"]`);
        slider.value        = this.params[key];
        valueEl.textContent = Number(this.params[key]).toFixed(decimals);
      });
      cb.checked = DEFAULTS.showCurves;
    });
  }

  // ─── public API ───────────────────────────────────────────────────────────

  toggleDebug() {
    this._debugVisible = !this._debugVisible;
    this._debugPanel.style.display = this._debugVisible ? 'flex' : 'none';
  }

  /**
   * Remove the sketch and debug panel. Call when tearing down the component.
   */
  destroy() {
    window.removeEventListener('keydown', this._onKey);
    this._sketch.remove();
    this._overlaySketch?.remove();
    this._debugPanel?.remove();
    this._debugToggleBtn?.remove();
    this.particles = [];
  }
}
