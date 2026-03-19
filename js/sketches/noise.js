/**
 * noise.js
 *
 * Exact port of p5.js's noise() / noiseDetail() implementation.
 *
 * p5 uses value noise (random floats, not gradient vectors) with cosine
 * interpolation and multi-octave accumulation. This is intentionally different
 * from classic "Perlin" gradient noise — the multi-octave value noise produces
 * the varied, multi-scale flow field character that p5 sketches rely on.
 *
 * Default behaviour (matches p5 defaults):
 *   4 octaves, 0.5 amplitude falloff per octave.
 *   Output range ≈ [0, 0.9375] (sum of 0.5 + 0.25 + 0.125 + 0.0625).
 *
 * Public API (drop-in for p.noise / p.noiseDetail / p.noiseSeed):
 *   noise(x, y?, z?)         — evaluate noise, z defaults to 0
 *   noiseDetail(lod, falloff) — set octave count and amplitude falloff
 *   noiseSeed(seed)           — reseed the lookup table (integer seed)
 */

// ── constants (from p5 source) ────────────────────────────────────────────
const PERLIN_SIZE = 4095;   // mask; table has 4096 entries
const YWRAP      = 1 << 4;  // 16 — y-dimension stride in the flat table
const ZWRAP      = 1 << 8;  // 256 — z-dimension stride

// ── mutable state ─────────────────────────────────────────────────────────
let _octaves  = 4;    // noiseDetail lod
let _falloff  = 0.5;  // noiseDetail falloff

/** @type {Float64Array|null} */
let _table = null;

// ── helpers ───────────────────────────────────────────────────────────────

/** Cosine ease — same as p5's internal scaled_cosine(). */
function scaledCos(t) {
  return 0.5 * (1.0 - Math.cos(t * Math.PI));
}

function _buildTable(rng) {
  _table = new Float64Array(PERLIN_SIZE + 1);
  for (let i = 0; i <= PERLIN_SIZE; i++) _table[i] = rng();
}

// ── public API ────────────────────────────────────────────────────────────

/**
 * Set octave count and amplitude falloff. Matches p5's noiseDetail().
 * @param {number} lod     - number of octaves (≥ 1)
 * @param {number} falloff - amplitude multiplier per octave (0–1)
 */
export function noiseDetail(lod, falloff) {
  if (lod     > 0) _octaves = lod;
  if (falloff > 0) _falloff = falloff;
}

/**
 * Reseed the lookup table for reproducible output.
 * Without a seed the table is filled with Math.random() on first use.
 * @param {number} seed - integer seed
 */
export function noiseSeed(seed) {
  let s = seed >>> 0;
  _buildTable(() => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return (s >>> 16) / 0x10000;
  });
}

/**
 * Evaluate multi-octave value noise at (x, y, z).
 * Matches p5.js noise() output exactly (same algorithm, same constants).
 *
 * @param {number} x
 * @param {number} [y=0]
 * @param {number} [z=0]
 * @returns {number} value in approximately [0, 0.9375] with default 4 octaves
 */
export function noise(x, y = 0, z = 0) {
  if (_table === null) _buildTable(Math.random);

  // p5 mirrors negative inputs
  if (x < 0) x = -x;
  if (y < 0) y = -y;
  if (z < 0) z = -z;

  let xi = Math.floor(x); let xf = x - xi;
  let yi = Math.floor(y); let yf = y - yi;
  let zi = Math.floor(z); let zf = z - zi;

  let result = 0;
  let ampl   = 0.5;

  for (let o = 0; o < _octaves; o++) {
    // Flat 3-D index into the table
    const base = xi + (yi << 4) + (zi << 8);

    const rxf = scaledCos(xf);
    const ryf = scaledCos(yf);
    const rzf = scaledCos(zf);

    // Trilinear interpolation using value noise
    // Front face (z plane)
    let n00 = _table[ base           & PERLIN_SIZE];
    let n10 = _table[(base + YWRAP)  & PERLIN_SIZE];
    n00 += rxf * (_table[(base + 1)          & PERLIN_SIZE] - n00);
    n10 += rxf * (_table[(base + YWRAP + 1)  & PERLIN_SIZE] - n10);
    let front = n00 + ryf * (n10 - n00);

    // Back face (z + ZWRAP plane)
    let n01 = _table[(base + ZWRAP)          & PERLIN_SIZE];
    let n11 = _table[(base + ZWRAP + YWRAP)  & PERLIN_SIZE];
    n01 += rxf * (_table[(base + ZWRAP + 1)         & PERLIN_SIZE] - n01);
    n11 += rxf * (_table[(base + ZWRAP + YWRAP + 1) & PERLIN_SIZE] - n11);
    let back = n01 + ryf * (n11 - n01);

    result += (front + rzf * (back - front)) * ampl;

    // Next octave: double frequency, halve amplitude
    ampl *= _falloff;
    xi <<= 1; if ((xf *= 2) >= 1) { xi++; xf--; }
    yi <<= 1; if ((yf *= 2) >= 1) { yi++; yf--; }
    zi <<= 1; if ((zf *= 2) >= 1) { zi++; zf--; }
  }

  return result;
}
