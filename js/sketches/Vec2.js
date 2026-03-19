/**
 * Vec2.js
 *
 * Lightweight 2D vector — replaces p5.Vector in Particle.js and FlowField.js.
 * Only implements the methods actually used by those classes.
 */

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Set components. Accepts either (x, y) scalars or a Vec2 / {x,y} object.
   * @param {number|{x:number,y:number}} x
   * @param {number} [y]
   * @returns {this}
   */
  set(x, y) {
    if (typeof x === 'object') { this.x = x.x; this.y = x.y; }
    else                       { this.x = x;   this.y = y;   }
    return this;
  }

  /** @returns {Vec2} shallow copy */
  copy() { return new Vec2(this.x, this.y); }

  /**
   * Add another vector (or {x,y} object) in-place.
   * @param {{x:number,y:number}} v
   * @returns {this}
   */
  add(v) { this.x += v.x; this.y += v.y; return this; }

  /**
   * Scale in-place by a scalar.
   * @param {number} s
   * @returns {this}
   */
  mult(s) { this.x *= s; this.y *= s; return this; }

  /**
   * Clamp magnitude to `max` in-place.
   * @param {number} max
   * @returns {this}
   */
  limit(max) {
    const mag2 = this.x * this.x + this.y * this.y;
    if (mag2 > max * max) {
      const s = max / Math.sqrt(mag2);
      this.x *= s;
      this.y *= s;
    }
    return this;
  }

  /**
   * Create a unit vector at angle `a`, optionally scaled to `len`.
   * @param {number} a   - angle in radians
   * @param {number} len - desired magnitude (default 1)
   * @returns {Vec2}
   */
  static fromAngle(a, len = 1) {
    return new Vec2(Math.cos(a) * len, Math.sin(a) * len);
  }
}
