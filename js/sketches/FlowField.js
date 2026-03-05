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

// ─── slider definitions ────────────────────────────────────────────────────
// Each entry drives both the default params and the debug UI.

const SLIDER_DEFS = [
  { key: 'particleCount', label: 'Particles',   min: 50,     max: 1500,  step: 1,       decimals: 0 },
  { key: 'noiseScale',    label: 'Noise scale', min: 0.0003, max: 0.012, step: 0.0001,  decimals: 4 },
  { key: 'noiseSpeed',    label: 'Noise speed', min: 0,      max: 0.002, step: 0.00005, decimals: 5 },
  { key: 'particleSpeed', label: 'Speed',       min: 0.2,    max: 8,     step: 0.1,     decimals: 1 },
  { key: 'trailAlpha',    label: 'Trail fade',  min: 1,      max: 80,    step: 1,       decimals: 0 },
  { key: 'particleAlpha', label: 'Opacity',     min: 10,     max: 255,   step: 1,       decimals: 0 },
  { key: 'particleSize',  label: 'Size',        min: 0.3,    max: 5,     step: 0.1,     decimals: 1 },
  { key: 'contourAlpha',  label: 'Contours',    min: 0,      max: 60,    step: 1,       decimals: 0 },
  { key: 'contourLevels', label: 'Iso levels',  min: 2,      max: 24,    step: 1,       decimals: 0 },
  { key: 'vectorAlpha',   label: 'Vectors',     min: 0,      max: 80,    step: 1,       decimals: 0 },
];

// ─── defaults ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  particleCount: 500,
  noiseScale:    0.0028,
  noiseSpeed:    0.00035,
  particleSpeed: 4.7,
  trailAlpha:    60,             // background fade per frame — lower = longer trails
  particleAlpha: 140,            // particle stroke alpha (0–255)
  particleSize:  1.0,            // stroke weight in pixels
  particleColor: theme.particle, // [r, g, b] — set to any theme colour or custom
  contourAlpha:  22,             // opacity of iso-contour lines (0 = off)
  contourLevels: 30,             // number of iso-value lines drawn
  vectorAlpha:   0,              // opacity of flow-direction tick marks (0 = off)
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

    this._t            = 0;       // noise time offset
    this._sketch       = null;
    this._debugPanel   = null;
    this._debugVisible = false;
    this._hoverRect    = null;    // DOMRect of the currently selected nav item
    this._audioPlayer  = null;    // AudioPlayer reference — read .analyser each frame
    this._audioAmp     = 0;       // smoothed amplitude (0..1)
    this._audioData    = null;    // reused Uint8Array for frequency data

    this._initSketch();
    this._initDebugPanel();

    // Global key listener so the toggle works regardless of canvas focus
    this._onKey = (e) => { if (e.key === '`') this.toggleDebug(); };
    window.addEventListener('keydown', this._onKey);
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
        // Semi-transparent black overlay creates motion trails.
        // trailAlpha controls how quickly old strokes fade.
        p.noStroke();
        p.fill(...BG, this.params.trailAlpha);
        p.rect(0, 0, p.width, p.height);

        // Advance noise time
        this._t += this.params.noiseSpeed;

        // Flow-direction vector tick marks
        if (this.params.vectorAlpha  > 0) this._drawVectors(p);

        // Topographic iso-contours of the noise field
        if (this.params.contourAlpha > 0) this._drawContours(p);

        // Maintain particle count dynamically (slider may have changed it)
        while (this.particles.length < this.params.particleCount) {
          this.particles.push(new Particle(p, this.params));
        }
        while (this.particles.length > this.params.particleCount) {
          this.particles.pop();
        }

        // ── Sample audio amplitude once per frame ─────────────────────────
        // Smoothed with exponential decay so forces feel fluid, not jittery.
        const analyser = this._audioPlayer?.analyser;
        if (analyser) {
          if (!this._audioData || this._audioData.length !== analyser.frequencyBinCount) {
            this._audioData = new Uint8Array(analyser.frequencyBinCount);
          }
          analyser.getByteFrequencyData(this._audioData);
          // Weight towards bass (first quarter of bins) for a punchy response
          const bassEnd = (this._audioData.length / 4) | 0;
          let sum = 0;
          for (let b = 0; b < bassEnd; b++) sum += this._audioData[b];
          const raw = sum / bassEnd / 255;
          this._audioAmp = this._audioAmp * 0.82 + raw * 0.18; // smooth
        } else {
          this._audioAmp *= 0.95; // decay to zero when no audio
        }

        // Update + draw every particle
        for (let i = 0; i < this.particles.length; i++) {
          const pt = this.particles[i];

          // Sample Perlin noise at this particle's position and current time.
          // Multiplying by TWO_PI * 2 gives two full rotations of coverage so
          // the field has varied curl and doesn't look too orderly.
          const nx    = pt.pos.x * this.params.noiseScale;
          const ny    = pt.pos.y * this.params.noiseScale;
          const angle = p.noise(nx, ny, this._t) * p.TWO_PI * 2;

          const force = p.createVector(Math.cos(angle), Math.sin(angle));
          force.mult(0.8);
          pt.applyForce(force);

          // ── Audio forces ───────────────────────────────────────────────
          if (this._audioAmp > 0.001) {
            // Ambient: upward lift proportional to amplitude
            pt.applyForce(p.createVector(0, -this._audioAmp * 3.5));

            // When a nav item is selected: additional burst away from it
            if (this._hoverRect) {
              const af = this._audioRepel(p, pt.pos.x, pt.pos.y);
              if (af) pt.applyForce(af);
            }
          }

          // Orbit particles around the selected nav element
          const orb = this._orbit(p, pt.pos.x, pt.pos.y);
          if (orb) pt.applyForce(orb);

          pt.update();
          pt.draw();

          if (pt.isDead()) pt.reset();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        p.background(...BG);
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

  /**
   * Pass the AudioPlayer instance so the FlowField can read its AnalyserNode
   * each frame and translate amplitude into particle forces.
   * @param {AudioPlayer} player
   */
  setAudioPlayer(player) {
    this._audioPlayer = player;
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

  // ─── audio repulsion from selected item ──────────────────────────────────

  /**
   * Returns an outward radial force from the selected nav element,
   * scaled by the current audio amplitude. Particles near the word
   * burst away in time with the music.
   * @param {object} p  - p5 instance
   * @param {number} px - particle x
   * @param {number} py - particle y
   * @returns {p5.Vector|null}
   */
  _audioRepel(p, px, py) {
    const r = this._hoverRect;
    if (!r) return null;

    const cx = (r.left + r.right)  / 2;
    const cy = (r.top  + r.bottom) / 2;
    const dx = px - cx, dy = py - cy;
    const dist = Math.hypot(dx, dy);
    const OUTER = 320;

    if (dist > OUTER || dist < 1) return null;

    // Fade force to zero at the outer edge
    const falloff = 1 - dist / OUTER;
    const strength = this._audioAmp * falloff * 5;

    return p.createVector((dx / dist) * strength, (dy / dist) * strength);
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

  // ─── debug panel ──────────────────────────────────────────────────────────

  _initDebugPanel() {
    const panel = document.createElement('div');
    panel.className = 'ff-debug';
    panel.setAttribute('aria-label', 'FlowField debug controls');

    const rows = SLIDER_DEFS.map(({ key, label, min, max, step }) => `
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
    `).join('');

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

    // Initialise value labels and wire up sliders
    SLIDER_DEFS.forEach(({ key, decimals }) => {
      const slider  = panel.querySelector(`input[data-param="${key}"]`);
      const valueEl = panel.querySelector(`[data-value="${key}"]`);

      valueEl.textContent = Number(this.params[key]).toFixed(decimals);

      slider.addEventListener('input', () => {
        const val         = parseFloat(slider.value);
        this.params[key]  = val;
        valueEl.textContent = val.toFixed(decimals);
      });
    });

    // Reset button
    panel.querySelector('.ff-debug__reset').addEventListener('click', () => {
      Object.assign(this.params, DEFAULTS);
      SLIDER_DEFS.forEach(({ key, decimals }) => {
        const slider  = panel.querySelector(`input[data-param="${key}"]`);
        const valueEl = panel.querySelector(`[data-value="${key}"]`);
        slider.value        = this.params[key];
        valueEl.textContent = Number(this.params[key]).toFixed(decimals);
      });
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
    this._debugPanel?.remove();
    this._debugToggleBtn?.remove();
    this.particles = [];
  }
}
