/**
 * Layer.js
 *
 * A managed canvas with multiple named draw passes. Native browser APIs only —
 * no p5.js dependency.
 *
 * Each Layer owns one <canvas> element and one requestAnimationFrame loop.
 * Draw passes are registered by name and execute in insertion order every frame.
 *
 * Usage:
 *   const layer = new Layer(containerEl, { clear: true, overlay: true });
 *   layer.add('particles', ({ ctx, width, height, frameCount }) => { ... });
 *   layer.add('hud',       ({ ctx, width, height, frameCount }) => { ... });
 *   layer.remove('hud');
 *   layer.canvas.addEventListener('mousedown', handler);
 *   layer.destroy();
 *
 * Options:
 *   clear    {boolean}  — clearRect each frame (transparent layer, no trail accumulation)
 *   overlay  {boolean}  — position absolute over the previous canvas; pointer-events: none
 *   onSetup  {function} — ({ ctx, width, height }) called once after canvas creation
 *   onResize {function} — ({ ctx, width, height }) called after resize
 */

export class Layer {
  /**
   * @param {HTMLElement} containerEl
   * @param {object}   [opts]
   * @param {boolean}  [opts.clear=false]   - clearRect each frame
   * @param {boolean}  [opts.overlay=false] - absolute position, no pointer events
   * @param {function} [opts.onSetup]       - ({ ctx, width, height }) => void
   * @param {function} [opts.onResize]      - ({ ctx, width, height }) => void
   */
  constructor(containerEl, { clear = false, overlay = false, onSetup = null, onResize = null } = {}) {
    this._clear   = clear;
    this._drawFns = new Map();
    this._animId  = null;
    this._frameCount = 0;

    // ── canvas setup ──────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    if (overlay) {
      canvas.style.position      = 'absolute';
      canvas.style.top           = '0';
      canvas.style.left          = '0';
      canvas.style.pointerEvents = 'none';
    }
    containerEl.appendChild(canvas);
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');

    // Size to window and apply DPR scaling
    this._resize();

    // onSetup callback — runs once with the initial context + dimensions
    if (onSetup) {
      const { w, h } = this._logicalSize();
      onSetup({ ctx: this._ctx, width: w, height: h });
    }

    // ── resize handling ───────────────────────────────────────────────────
    this._onResize = () => {
      this._resize();
      if (onResize) {
        const { w, h } = this._logicalSize();
        onResize({ ctx: this._ctx, width: w, height: h });
      }
    };
    window.addEventListener('resize', this._onResize);

    // ── start RAF loop ────────────────────────────────────────────────────
    this._loop();
  }

  // ── private ──────────────────────────────────────────────────────────────

  /** Logical (CSS pixel) dimensions of the window */
  _logicalSize() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  /** Resize canvas to current window size, scaled by devicePixelRatio. */
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = this._logicalSize();

    this._canvas.width        = w * dpr;
    this._canvas.height       = h * dpr;
    this._canvas.style.width  = `${w}px`;
    this._canvas.style.height = `${h}px`;

    // Re-apply DPR scale after each resize (canvas reset clears transform)
    this._ctx.scale(dpr, dpr);
  }

  _loop() {
    this._animId = requestAnimationFrame(() => this._loop());

    const { w, h } = this._logicalSize();

    if (this._clear) this._ctx.clearRect(0, 0, w, h);

    for (const fn of this._drawFns.values()) {
      fn({ ctx: this._ctx, width: w, height: h, frameCount: this._frameCount });
    }

    this._frameCount++;
  }

  // ── public API ───────────────────────────────────────────────────────────

  /**
   * Register a named draw pass. Passes execute in insertion order each frame.
   * If a pass with this name already exists it is replaced in-place.
   * @param {string}   id - unique pass name
   * @param {function} fn - ({ ctx, width, height, frameCount }) => void
   * @returns {this}
   */
  add(id, fn) {
    this._drawFns.set(id, fn);
    return this;
  }

  /**
   * Remove a named draw pass. No-op if id doesn't exist.
   * @param {string} id
   * @returns {this}
   */
  remove(id) {
    this._drawFns.delete(id);
    return this;
  }

  /** The raw HTMLCanvasElement — attach event listeners here directly. */
  get canvas() { return this._canvas; }

  /** Stop the RAF loop and remove the canvas element. */
  destroy() {
    if (this._animId !== null) cancelAnimationFrame(this._animId);
    window.removeEventListener('resize', this._onResize);
    this._canvas.remove();
  }
}
