/**
 * Layer.js
 *
 * A managed p5 canvas with multiple named draw passes.
 *
 * Each Layer owns one p5 instance (and therefore one <canvas> element).
 * Draw passes are registered by name and execute in insertion order every frame.
 * This makes it easy to assign rendering responsibilities to specific layers,
 * reorder them, or move them between layers without touching the p5 boilerplate.
 *
 * Usage:
 *   const layer = new Layer(containerEl, { clear: true, overlay: true });
 *   layer.add('particles', (p) => { ... });  // registered draw pass
 *   layer.add('hud',       (p) => { ... });  // runs after 'particles' each frame
 *   layer.remove('hud');                      // remove a pass
 *   layer.p.mousePressed = (e) => { ... };   // attach p5 event handlers directly
 *   layer.destroy();                          // remove canvas + stop loop
 *
 * Options:
 *   clear    {boolean} — call p.clear() each frame (transparent layer, no trail accumulation)
 *   overlay  {boolean} — position absolute over the previous canvas; pointer-events: none
 *   onSetup  {function(p)} — called once after canvas creation, inside p5's setup()
 *   onResize {function(p)} — called after canvas resize, inside p5's windowResized()
 */

export class Layer {
  /**
   * @param {HTMLElement} containerEl
   * @param {object}      [opts]
   * @param {boolean}     [opts.clear=false]   - clear canvas each frame (transparent)
   * @param {boolean}     [opts.overlay=false] - position absolute, pointer-events none
   * @param {function}    [opts.onSetup]       - (p) => void, runs after canvas creation
   * @param {function}    [opts.onResize]      - (p) => void, runs after canvas resize
   */
  constructor(containerEl, { clear = false, overlay = false, onSetup = null, onResize = null } = {}) {
    this._clear   = clear;
    this._drawFns = new Map();  // name → (p) => void, executes in insertion order

    // p5 is loaded globally via CDN — no import needed.
    // eslint-disable-next-line no-undef
    this.sketch = new p5((p) => {

      p.setup = () => {
        const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
        cnv.style('display', 'block');
        if (overlay) {
          cnv.style('position',       'absolute');
          cnv.style('top',            '0');
          cnv.style('left',           '0');
          cnv.style('pointer-events', 'none');
        }
        if (clear) p.clear();
        if (onSetup) onSetup(p);
      };

      p.draw = () => {
        if (this._clear) p.clear();
        for (const fn of this._drawFns.values()) fn(p);
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        if (this._clear) p.clear();
        if (onResize) onResize(p);
      };

    }, containerEl);
  }

  /**
   * Register a named draw pass. Passes run in insertion order each frame.
   * If a pass with this name already exists it is replaced in-place (preserving order).
   * @param {string}   id - unique name for this pass
   * @param {function} fn - (p: p5) => void
   * @returns {this} for chaining
   */
  add(id, fn) {
    this._drawFns.set(id, fn);
    return this;
  }

  /**
   * Remove a named draw pass. No-op if the id doesn't exist.
   * @param {string} id
   * @returns {this} for chaining
   */
  remove(id) {
    this._drawFns.delete(id);
    return this;
  }

  /**
   * The underlying p5 instance.
   * Use this to attach event handlers (mousePressed, touchStarted, etc.)
   * or access p5 utilities (p.noise, p.createVector, p.drawingContext, …).
   * @returns {object} p5 instance
   */
  get p() { return this.sketch; }

  /** Remove the canvas element and stop the draw loop. */
  destroy() { this.sketch.remove(); }
}
