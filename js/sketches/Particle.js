/**
 * Particle.js
 *
 * A single particle that moves through a flow field.
 * Keeps a reference to the live `params` object from FlowField so every
 * property change (speed, size, opacity …) takes effect immediately without
 * re-creating particles.
 *
 * Exposed properties other components may read:
 *   particle.pos   — p5.Vector (current position)
 *   particle.vel   — p5.Vector (current velocity)
 *   particle.age   — number   (frames alive)
 *   particle.x / .y — convenience getters
 */
export class Particle {
  /**
   * @param {object} p      - p5 instance
   * @param {object} params - live params reference from FlowField
   */
  constructor(p, params) {
    this.p      = p;
    this.params = params;
    this._spawn();
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  _spawn() {
    const p = this.p;
    this.pos     = p.createVector(p.random(p.width), p.random(p.height));
    this.prevPos = this.pos.copy();

    // Small random initial velocity so particles don't all start stationary
    const angle  = p.random(p.TWO_PI);
    this.vel     = p.createVector(Math.cos(angle), Math.sin(angle)).mult(0.1);
    this.acc     = p.createVector(0, 0);

    this.age      = 0;
    this.lifespan = p.random(150, 550);
  }

  reset() {
    this._spawn();
  }

  isDead() {
    return this.age >= this.lifespan;
  }

  // ─── physics ──────────────────────────────────────────────────────────────

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.prevPos.set(this.pos);

    this.vel.add(this.acc);
    this.vel.limit(this.params.particleSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
    this.age++;

    this._wrapEdges();
  }

  _wrapEdges() {
    const p = this.p;
    let wrapped = false;

    if (this.pos.x > p.width)  { this.pos.x = 0;        wrapped = true; }
    if (this.pos.x < 0)        { this.pos.x = p.width;  wrapped = true; }
    if (this.pos.y > p.height) { this.pos.y = 0;        wrapped = true; }
    if (this.pos.y < 0)        { this.pos.y = p.height; wrapped = true; }

    // Reset previous position on wrap to prevent edge-crossing artefacts
    if (wrapped) this.prevPos.set(this.pos);
  }

  // ─── rendering ────────────────────────────────────────────────────────────

  draw() {
    const p = this.p;

    // Fade in at birth, fade out near death
    const fadeIn  = Math.min(this.age / 60, 1);
    const fadeOut = Math.min((this.lifespan - this.age) / 60, 1);
    const alpha   = Math.min(fadeIn, fadeOut) * this.params.particleAlpha;

    const color = this._colorOverride ?? this.params.particleColor;
    const size  = this._sizeOverride  ?? this.params.particleSize;
    p.stroke(...color, alpha);
    p.strokeWeight(size);
    p.line(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
  }

  // ─── convenience ──────────────────────────────────────────────────────────

  get x() { return this.pos.x; }
  get y() { return this.pos.y; }
}
