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
];

// ─── defaults ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  particleCount: 500,
  noiseScale:    0.0028,
  noiseSpeed:    0.00035,
  particleSpeed: 2.2,
  trailAlpha:    18,             // background fade per frame — lower = longer trails
  particleAlpha: 140,            // particle stroke alpha (0–255)
  particleSize:  1.0,            // stroke weight in pixels
  particleColor: theme.particle, // [r, g, b] — set to any theme colour or custom
  contourAlpha:  22,             // opacity of iso-contour lines (0 = off)
  contourLevels: 10,             // number of iso-value lines drawn
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

        // Topographic iso-contours of the noise field
        if (this.params.contourAlpha > 0) this._drawContours(p);

        // Maintain particle count dynamically (slider may have changed it)
        while (this.particles.length < this.params.particleCount) {
          this.particles.push(new Particle(p, this.params));
        }
        while (this.particles.length > this.params.particleCount) {
          this.particles.pop();
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

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tl = grid[r       * stride + c    ];
        const tr = grid[r       * stride + c + 1];
        const br = grid[(r + 1) * stride + c + 1];
        const bl = grid[(r + 1) * stride + c    ];

        const x0 = c * CELL;
        const y0 = r * CELL;

        for (let li = 1; li <= levels; li++) {
          const L   = li / (levels + 1); // evenly spaced iso-values in (0,1)
          const pts = [];

          // Top edge: tl → tr
          if ((tl - L) * (tr - L) < 0) {
            const t = (L - tl) / (tr - tl);
            pts.push(x0 + t * CELL, y0);
          }
          // Right edge: tr → br
          if ((tr - L) * (br - L) < 0) {
            const t = (L - tr) / (br - tr);
            pts.push(x0 + CELL, y0 + t * CELL);
          }
          // Bottom edge: bl → br
          if ((bl - L) * (br - L) < 0) {
            const t = (L - bl) / (br - bl);
            pts.push(x0 + t * CELL, y0 + CELL);
          }
          // Left edge: tl → bl
          if ((tl - L) * (bl - L) < 0) {
            const t = (L - tl) / (bl - tl);
            pts.push(x0, y0 + t * CELL);
          }

          // Draw a line between the first two crossings found (handles
          // the common 2-crossing case; saddle-point cells are skipped)
          if (pts.length >= 4) {
            p.line(pts[0], pts[1], pts[2], pts[3]);
          }
        }
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
        <kbd>\`</kbd>
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
    this._debugPanel.style.display     = this._debugVisible ? 'flex' : 'none';
    this._debugToggleBtn.style.display = this._debugVisible ? 'none' : 'block';
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
