/**
 * Particle.js
 *
 * A single particle that moves through a flow field.
 * Keeps a reference to the live `params` object from FlowField so every
 * property change (speed, size, opacity …) takes effect immediately without
 * re-creating particles.
 *
 * Exposed properties other components may read:
 *   particle.pos   — Vec2 (current position)
 *   particle.vel   — Vec2 (current velocity)
 *   particle.age   — number   (frames alive)
 *   particle.x / .y — convenience getters
 */
import { Vec2 } from './Vec2.js';

export class Particle {
  /**
   * @param {{ width: number, height: number }} dims   - live canvas dimensions ref
   * @param {object}                            params - live params reference from FlowField
   */
  constructor(dims, params) {
    this.dims   = dims;    // live reference — resize updates automatically
    this.params = params;
    this._spawn();
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  _spawn() {
    const { width, height } = this.dims;
    this.pos     = new Vec2(Math.random() * width, Math.random() * height);
    this.prevPos = this.pos.copy();

    // Small random initial velocity so particles don't all start stationary
    const angle  = Math.random() * Math.PI * 2;
    this.vel     = new Vec2(Math.cos(angle) * 0.1, Math.sin(angle) * 0.1);
    this.acc     = new Vec2(0, 0);

    this.age      = 0;
    this.lifespan = 150 + Math.random() * 400;  // equivalent to p.random(150, 550)
  }

  reset() {
    this._spawn();
  }

  isDead() {
    return this.age >= this.lifespan;
  }

  // ─── physics ──────────────────────────────────────────────────────────────

  /**
   * Add a force to the accumulator.
   * @param {{x:number, y:number}} force - Vec2 or plain {x,y} object
   */
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
    const { width, height } = this.dims;
    let wrapped = false;

    if (this.pos.x > width)  { this.pos.x = 0;      wrapped = true; }
    if (this.pos.x < 0)      { this.pos.x = width;  wrapped = true; }
    if (this.pos.y > height) { this.pos.y = 0;      wrapped = true; }
    if (this.pos.y < 0)      { this.pos.y = height; wrapped = true; }

    // Reset previous position on wrap to prevent edge-crossing artefacts
    if (wrapped) this.prevPos.set(this.pos);
  }

  // ─── rendering ────────────────────────────────────────────────────────────

  /**
   * Draw the particle trail as a line from prevPos to pos.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // Fade in at birth, fade out near death
    const fadeIn  = Math.min(this.age / 60, 1);
    const fadeOut = Math.min((this.lifespan - this.age) / 60, 1);
    const alpha   = Math.min(fadeIn, fadeOut) * this.params.particleAlpha;

    const color = this._colorOverride ?? this.params.particleColor;
    const size  = this._sizeOverride  ?? this.params.particleSize;

    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${(alpha / 255).toFixed(3)})`;
    ctx.lineWidth   = size;
    ctx.beginPath();
    ctx.moveTo(this.prevPos.x, this.prevPos.y);
    ctx.lineTo(this.pos.x, this.pos.y);
    ctx.stroke();
  }

  // ─── convenience ──────────────────────────────────────────────────────────

  get x() { return this.pos.x; }
  get y() { return this.pos.y; }
}
