// ─── sketch.js ────────────────────────────────────────────────────────────────
// p5.js global-mode sketch. All tuneable values live in js/config.js.
//
// Visual layers (draw order):
//   1. Nebula clouds       Perlin-noise blobs, audio-reactive scale
//   2. Star field          dots, twinkle on high-freq energy
//   3. Flow particles      noise vector field, mouse/touch attraction
//   4. Constellation lines dashed lines between nodes
//   5. Frequency ring      circular FFT visualiser at canvas centre
//   6. Nav nodes           glow circles — Music, Artwork, Performances, Installations
//   7. Identity text       name + tagline
//   8. Player viz          16 HTML bars updated from spectrum

// ── Active config (set/refreshed in setup + windowResized) ───────────────────
let cfg;

// ── Classes ───────────────────────────────────────────────────────────────────

class Star {
  constructor() {
    this.x        = random(width);
    this.y        = random(height);
    this.sz       = random(0.5, 2.5);
    this.noiseOff = random(10000);
  }

  draw(highEnergy) {
    const twinkle = noise(this.noiseOff + frameCount * 0.013);
    const boost   = map(highEnergy, 0, 255, 0, 0.4);
    const alpha   = map(twinkle + boost, 0, 1.3, 45, 255);
    fill(255, 255, 255, constrain(alpha, 20, 255));
    noStroke();
    circle(this.x, this.y, this.sz * (1 + boost * 0.8));
  }
}

class Particle {
  constructor() {
    this.noiseOff = random(10000);
    this.reset();
  }

  reset() {
    this.x     = random(width);
    this.y     = random(height);
    this.sz    = random(1, 3);
    this.alpha = random(70, 170);
    this.mult  = random(0.5, 1.5);
  }

  update(bassEnergy, mx, my) {
    const sc    = 0.0018;
    const angle = noise(this.x * sc, this.y * sc, noiseT * 0.0025) * TWO_PI * 2;
    const speed = map(bassEnergy, 0, 255, 0.2, 2.8) * this.mult;

    this.x += cos(angle) * speed;
    this.y += sin(angle) * speed;

    // Touch/mouse attraction
    const dx = mx - this.x;
    const dy = my - this.y;
    const d  = sqrt(dx * dx + dy * dy);
    if (d > 1 && d < cfg.mouseAttractionRadius) {
      this.x += (dx / d) * cfg.mouseAttractionStrength;
      this.y += (dy / d) * cfg.mouseAttractionStrength;
    }

    if (this.x < -10 || this.x > width + 10 || this.y < -10 || this.y > height + 10) {
      this.reset();
    }
  }

  draw(level) {
    const a = this.alpha * (0.4 + level * 2.0);
    fill(255, 255, 255, constrain(a, 10, 210));
    noStroke();
    circle(this.x, this.y, this.sz);
  }
}

class CanvasNode {
  constructor(xFrac, yFrac, label, id) {
    this.xFrac    = xFrac;
    this.yFrac    = yFrac;
    this.label    = label;
    this.id       = id;
    this.displayR = cfg.nodeRadius;
    this.hovered  = false;
  }

  get x() { return width  * this.xFrac; }
  get y() { return height * this.yFrac; }

  update() {
    const target  = this.hovered ? cfg.nodeRadius * 1.28 : cfg.nodeRadius;
    this.displayR = lerp(this.displayR, target, 0.1);
  }

  checkHover(px, py) {
    this.hovered = dist(px, py, this.x, this.y) < this.displayR + cfg.nodeClickRadius;
  }

  checkClick(px, py) {
    return dist(px, py, this.x, this.y) < this.displayR + cfg.nodeClickRadius;
  }

  draw(bassEnergy) {
    const cx    = this.x;
    const cy    = this.y;
    const pulse = map(bassEnergy, 0, 255, 0, 1);
    const r     = this.displayR;

    push();

    // Outer glow rings
    noFill();
    strokeWeight(this.hovered ? 1.2 : 0.8);
    for (let i = 4; i >= 1; i--) {
      const ringR = r + i * 13 + pulse * 7 * i;
      const base  = this.hovered ? map(i, 4, 1, 8, 32) : map(i, 4, 1, 3, 12);
      stroke(220, 20, 60, base + pulse * 22);
      circle(cx, cy, ringR * 2);
    }

    // Core circle
    noStroke();
    fill(220, 20, 60, this.hovered ? 215 : 120 + pulse * 80);
    circle(cx, cy, r * 2);

    // Bright inner highlight
    fill(255, 185, 185, this.hovered ? 240 : 180);
    circle(cx, cy, r * 0.32);

    // Label
    textFont('Poppins, sans-serif');
    textAlign(CENTER, TOP);
    textStyle(NORMAL);
    noStroke();
    if (this.hovered) {
      textSize(cfg.nodeLabelHoveredSize);
      fill(255, 255);
    } else {
      textSize(cfg.nodeLabelSize);
      fill(255, 175);
    }
    text(this.label, cx, cy + r + 11);

    pop();
  }
}

// ── Globals ───────────────────────────────────────────────────────────────────
let stars     = [];
let particles = [];
let nodes     = [];
let noiseT    = 0;

// Touch/mouse pointer position (unified for both input types)
let pointerX = 0;
let pointerY = 0;

// ── p5 lifecycle ──────────────────────────────────────────────────────────────

function setup() {
  cfg = getConfig();

  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.style('z-index', '0');
  cnv.style('touch-action', 'none'); // prevent browser scroll/zoom on canvas touch
  colorMode(RGB, 255);
  textFont('Poppins, sans-serif');

  for (let i = 0; i < cfg.starCount;     i++) stars.push(new Star());
  for (let i = 0; i < cfg.particleCount; i++) particles.push(new Particle());

  _buildNodes();

  audioSys.init(AUDIO_TRACKS);
  uiSys.init();
}

function _buildNodes() {
  nodes = cfg.nodes.map(n => new CanvasNode(n.xFrac, n.yFrac, n.label, n.id));
}

function draw() {
  const bass     = audioSys.getBass();
  const high     = audioSys.getHigh();
  const level    = audioSys.getLevel();
  const spectrum = audioSys.getFFT();

  background(8, 8, 8);
  noiseT++;

  _drawNebula(bass);

  noStroke();
  for (const s of stars)     s.draw(high);
  for (const p of particles) { p.update(bass, pointerX, pointerY); p.draw(level); }

  if (cfg.showConstellations) _drawConstellationLines(level);
  if (cfg.showFrequencyRing)  _drawFrequencyRing(spectrum);

  for (const n of nodes) { n.update(); n.draw(bass); }

  _drawIdentityText();
  _updatePlayerViz(spectrum);
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function _drawNebula(bass) {
  const bScale = map(bass, 0, 255, 1, 1.22);
  noStroke();

  for (let i = 0; i < cfg.nebulaCrimsonBlobs; i++) {
    const nx = noise(i * 97.3,  noiseT * 0.0006)        * width;
    const ny = noise(i * 143.7, noiseT * 0.0005 + 100)  * height;
    const nr = noise(i * 211.1, noiseT * 0.0008 + 200)  * 280 + 170;
    fill(200, 12, 38, 7 + bass * 0.025);
    ellipse(nx, ny, nr * bScale, nr * 0.62 * bScale);
  }

  for (let i = 0; i < cfg.nebulaPurpleBlobs; i++) {
    const nx = noise(i * 80.5  + 500, noiseT * 0.0005)       * width;
    const ny = noise(i * 120.3 + 500, noiseT * 0.0007 + 300) * height;
    const nr = noise(i * 170.7 + 500, noiseT * 0.0009 + 400) * 220 + 120;
    fill(52, 8, 105, 5 + bass * 0.016);
    ellipse(nx, ny, nr * bScale, nr * 0.52 * bScale);
  }

  for (let i = 0; i < cfg.nebulaBlueBlobs; i++) {
    const nx = noise(i * 160.9 + 1000, noiseT * 0.0004 + 700) * width;
    const ny = noise(i * 230.1 + 1000, noiseT * 0.0006 + 800) * height;
    const nr = noise(i * 310.3 + 1000, noiseT * 0.0005 + 900) * 190 + 110;
    fill(8, 12, 88, 4 + bass * 0.013);
    ellipse(nx, ny, nr * bScale, nr * 0.48 * bScale);
  }
}

function _drawConstellationLines(level) {
  const alpha = constrain(map(level, 0, 0.4, 14, 48) + 14, 14, 60);
  stroke(255, 255, 255, alpha);
  strokeWeight(0.4);
  noFill();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      _dashedLine(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, 6, 9);
    }
  }
}

function _dashedLine(x1, y1, x2, y2, dashLen, gapLen) {
  const dx    = x2 - x1;
  const dy    = y2 - y1;
  const total = sqrt(dx * dx + dy * dy);
  if (total === 0) return;
  const nx = dx / total;
  const ny = dy / total;
  let pos = 0;
  let on  = true;

  while (pos < total) {
    const seg = on ? dashLen : gapLen;
    const end = min(pos + seg, total);
    if (on) line(x1 + nx * pos, y1 + ny * pos, x1 + nx * end, y1 + ny * end);
    pos = end;
    on  = !on;
  }
}

function _drawFrequencyRing(spectrum) {
  const cx      = width  / 2;
  const cy      = height / 2;
  // Smaller ring on mobile so it doesn't crowd the nodes
  const innerR  = map(width, 320, 1440, 36, 52);
  const maxH    = map(width, 320, 1440, 20, 32);
  const hasData = spectrum.some(v => v > 0);

  if (!hasData) {
    noFill();
    stroke(220, 20, 60, 10);
    strokeWeight(0.5);
    circle(cx, cy, innerR * 2);
    return;
  }

  noFill();
  strokeWeight(1.2);

  for (let i = 0; i < spectrum.length; i++) {
    const angle = map(i, 0, spectrum.length, -HALF_PI, TWO_PI - HALF_PI);
    const h     = map(spectrum[i], 0, 255, 0, maxH);
    const x1    = cx + cos(angle) * innerR;
    const y1    = cy + sin(angle) * innerR;
    const x2    = cx + cos(angle) * (innerR + h);
    const y2    = cy + sin(angle) * (innerR + h);
    stroke(220, 20, 60, map(spectrum[i], 0, 255, 18, 200));
    line(x1, y1, x2, y2);
  }

  noFill();
  stroke(220, 20, 60, 22);
  strokeWeight(0.5);
  circle(cx, cy, innerR * 2);
}

function _drawIdentityText() {
  push();
  noStroke();
  textStyle(BOLD);

  const titleSize = constrain(width * cfg.titleSizeVW, cfg.titleSizeMin, cfg.titleSizeMax);
  textSize(titleSize);
  textFont('Poppins, sans-serif');

  const first  = 'PETER ';
  const last   = 'LILEY';
  const fw     = textWidth(first);
  const lw     = textWidth(last);
  const startX = (width - fw - lw) / 2;
  const titleY = height * cfg.titleY;

  textAlign(LEFT, CENTER);
  fill(255, 228);
  text(first, startX, titleY);
  fill(220, 20, 60, 240);
  text(last, startX + fw, titleY);

  const tagSize = constrain(width * cfg.taglineSizeVW, cfg.taglineSizeMin, cfg.taglineSizeMax);
  textSize(tagSize);
  textStyle(NORMAL);
  textAlign(CENTER, CENTER);
  fill(255, 115);
  text('saxophonist  ·  composer  ·  artist  ·  Pōneke, NZ', width / 2, titleY + titleSize * 0.9);

  pop();
}

function _updatePlayerViz(spectrum) {
  const bars = document.querySelectorAll('.viz-bar');
  if (!bars.length) return;
  const step = Math.floor(spectrum.length / bars.length) || 1;
  bars.forEach((bar, i) => {
    bar.style.height = map(spectrum[i * step] || 0, 0, 255, 2, 20) + 'px';
  });
}

// ── Mouse event handlers ──────────────────────────────────────────────────────

function mousePressed() {
  if (uiSys.isOpen) return;
  pointerX = mouseX;
  pointerY = mouseY;
  userStartAudio();
  for (const n of nodes) {
    if (n.checkClick(mouseX, mouseY)) { uiSys.open(n.id); return; }
  }
}

function mouseMoved() {
  pointerX = mouseX;
  pointerY = mouseY;
  if (uiSys.isOpen) { for (const n of nodes) n.hovered = false; return; }
  let anyHovered = false;
  for (const n of nodes) { n.checkHover(mouseX, mouseY); if (n.hovered) anyHovered = true; }
  document.body.style.cursor = anyHovered ? 'pointer' : 'default';
}

// ── Touch event handlers ──────────────────────────────────────────────────────
// p5 maps some touch to mouse, but explicit handlers ensure reliable behaviour
// on all mobile browsers. Return false to prevent default scroll/zoom.

function touchStarted() {
  if (touches.length === 0) return false;
  if (uiSys.isOpen)         return false;

  const tx = touches[0].x;
  const ty = touches[0].y;
  pointerX = tx;
  pointerY = ty;
  userStartAudio();

  for (const n of nodes) {
    if (n.checkClick(tx, ty)) { uiSys.open(n.id); return false; }
  }
  return false;
}

function touchMoved() {
  if (touches.length > 0) {
    pointerX = touches[0].x;
    pointerY = touches[0].y;
  }
  return false; // prevent page scroll while dragging canvas
}

function touchEnded() {
  // Reset hover state when finger lifts
  for (const n of nodes) n.hovered = false;
  return false;
}

// ── Window resize ─────────────────────────────────────────────────────────────

function windowResized() {
  cfg = getConfig(); // re-evaluate breakpoint
  resizeCanvas(windowWidth, windowHeight);
  _buildNodes();
  for (const s of stars) { s.x = random(width); s.y = random(height); }
}
