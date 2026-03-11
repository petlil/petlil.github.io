/**
 * benchmark.js — Removable performance benchmarking overlay.
 *
 * Shows a live panel with FPS rolling averages, load timings, and resource
 * stats. "Copy CSV row" copies a fully-formatted row ready to paste into
 * tests/results.csv.
 *
 * TO REMOVE:
 *   1. Delete  js/core/benchmark.js
 *   2. Remove  the import + initBenchmark() call from js/app.js
 *   3. Keep    tests/results.csv (your data stays)
 */

// ── FPS tracking ───────────────────────────────────────────────────────────

const RING_SIZE = 600; // ~10 s at 60 fps — ring buffer of frame timestamps
const ring      = new Float64Array(RING_SIZE);
let   ringHead  = 0;
let   ringCount = 0;
let   fpsMin    = Infinity;
let   fpsMax    = 0;
let   lastTs    = 0;

function tick(now) {
  if (lastTs > 0) {
    const fps = 1000 / (now - lastTs);
    if (fps < fpsMin) fpsMin = fps;
    if (fps > fpsMax) fpsMax = fps;
  }
  lastTs = now;

  ring[ringHead] = now;
  ringHead = (ringHead + 1) % RING_SIZE;
  if (ringCount < RING_SIZE) ringCount++;

  requestAnimationFrame(tick);
}

/** Average FPS over the last `windowMs` milliseconds. */
function fpsAvg(windowMs) {
  const now    = performance.now();
  const cutoff = now - windowMs;
  let   count  = 0;
  let   oldest = now;

  for (let i = 0; i < ringCount; i++) {
    const idx = (ringHead - 1 - i + RING_SIZE) % RING_SIZE;
    const t   = ring[idx];
    if (t < cutoff) break;
    count++;
    oldest = t;
  }
  if (count < 2) return 0;
  return (count - 1) / ((now - oldest) / 1000);
}

function fpsInstant() {
  if (ringCount < 2) return 0;
  const a = ring[(ringHead - 1 + RING_SIZE) % RING_SIZE];
  const b = ring[(ringHead - 2 + RING_SIZE) % RING_SIZE];
  return b > 0 ? 1000 / (a - b) : 0;
}

// ── Web Vitals ─────────────────────────────────────────────────────────────

let fcp = null;
let lcp = null;

if ('PerformanceObserver' in window) {
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries())
        if (e.name === 'first-contentful-paint') fcp = e.startTime;
    }).observe({ type: 'paint', buffered: true });

    new PerformanceObserver(list => {
      for (const e of list.getEntries()) lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (_) {}
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadTimings() {
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav) return { dcl: null, load: null };
  return {
    dcl:  Math.round(nav.domContentLoadedEventEnd - nav.startTime),
    load: Math.round(nav.loadEventEnd             - nav.startTime),
  };
}

function resourceStats() {
  const rs = performance.getEntriesByType('resource');
  return {
    requests:   rs.length,
    transferKb: Math.round(rs.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
  };
}

function memoryMb() {
  const m = performance.memory;   // Chrome only
  return m ? (m.usedJSHeapSize / 1024 / 1024).toFixed(1) : '';
}

function connectionType() {
  return navigator.connection?.effectiveType ?? '';
}

function browserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/'))     return 'Edge';
  if (ua.includes('Chrome/'))  return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/'))  return 'Safari';
  return 'other';
}

function deviceType() {
  const w = window.innerWidth;
  return w <= 480 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop';
}

// ── CSV row builder ────────────────────────────────────────────────────────

function buildRow(notes, flowField) {
  const { dcl, load } = loadTimings();
  const { requests, transferKb } = resourceStats();
  const inst  = fpsInstant();
  const avg1  = fpsAvg(1_000);
  const avg5  = fpsAvg(5_000);
  const avg10 = fpsAvg(10_000);

  const particles = flowField?.params?.particleCount ?? '';

  const values = [
    new Date().toISOString(),                                    // timestamp
    notes,                                                        // notes (manual)
    '',                                                           // throttle (manual)
    '',                                                           // cpu_throttle (manual)
    browserName(),                                               // browser
    deviceType(),                                                // device
    `${window.innerWidth}x${window.innerHeight}`,               // viewport
    connectionType(),                                            // connection
    document.querySelector('.section.is-active')?.dataset?.slug ?? 'none', // section_open
    document.getElementById('section-extra') ? 'yes' : 'no',   // extra_active
    dcl  ?? '',                                                  // dcl_ms
    load ?? '',                                                  // load_ms
    fcp  ? Math.round(fcp) : '',                                 // fcp_ms
    lcp  ? Math.round(lcp) : '',                                 // lcp_ms
    inst  > 0 ? inst.toFixed(1)  : '',                          // fps_instant
    avg1  > 0 ? avg1.toFixed(1)  : '',                          // fps_avg_1s
    avg5  > 0 ? avg5.toFixed(1)  : '',                          // fps_avg_5s
    avg10 > 0 ? avg10.toFixed(1) : '',                          // fps_avg_10s
    fpsMin < Infinity ? fpsMin.toFixed(1) : '',                  // fps_min
    fpsMax > 0        ? fpsMax.toFixed(1) : '',                  // fps_max
    requests,                                                    // requests
    transferKb,                                                  // transfer_kb
    memoryMb(),                                                  // memory_mb
    particles,                                                   // p5_particles
  ];

  return values
    .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',');
}

// ── Overlay UI ─────────────────────────────────────────────────────────────

const PANEL_STYLE = `
  position: fixed; bottom: 1.25rem; left: 1.25rem;
  background: rgba(8, 8, 12, 0.90);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 12px;
  padding: 0.7rem 0.85rem;
  font: 11px/1.7 'Courier New', monospace;
  color: #c8e6c9;
  z-index: 8999;
  width: 210px;
  pointer-events: all;
  user-select: none;
`;

const INPUT_STYLE = `
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: #fff; font: 11px 'Courier New', monospace;
  padding: 2px 6px; margin-bottom: 5px;
  outline: none;
`;

const BTN_STYLE = `
  margin-top: 5px; width: 100%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 5px;
  color: #c8e6c9; font: 11px 'Courier New', monospace;
  padding: 4px 0; cursor: pointer;
`;

function row(label, value, colour) {
  const c = colour ?? '#c8e6c9';
  return `<div><span style="color:#78909c">${label}</span><span style="color:${c};float:right">${value}</span></div>`;
}

function fpsColour(fps) {
  if (fps >= 55) return '#69f0ae';
  if (fps >= 30) return '#ffeb3b';
  return '#ff5252';
}

function createOverlay(flowField) {
  const panel = document.createElement('div');
  panel.id = 'bm-panel';
  panel.style.cssText = PANEL_STYLE;

  const notesInput = document.createElement('input');
  notesInput.placeholder = 'notes…';
  notesInput.style.cssText = INPUT_STYLE;
  notesInput.addEventListener('click', e => e.stopPropagation());

  const stats = document.createElement('div');

  const btn = document.createElement('button');
  btn.textContent = 'Copy CSV row';
  btn.style.cssText = BTN_STYLE;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const csvRow = buildRow(notesInput.value, flowField);
    navigator.clipboard.writeText(csvRow).then(() => {
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = 'Copy CSV row'; }, 2000);
    }).catch(() => {
      // Fallback: log to console so they can copy manually
      console.log('CSV row:', csvRow);
      btn.textContent = 'See console';
      setTimeout(() => { btn.textContent = 'Copy CSV row'; }, 2000);
    });
  });

  panel.appendChild(notesInput);
  panel.appendChild(stats);
  panel.appendChild(btn);
  document.body.appendChild(panel);

  return { stats, notesInput };
}

function updateStats(statsEl, flowField) {
  const { dcl, load } = loadTimings();
  const { requests, transferKb } = resourceStats();
  const inst  = fpsInstant();
  const avg1  = fpsAvg(1_000);
  const avg5  = fpsAvg(5_000);
  const avg10 = fpsAvg(10_000);
  const mem   = memoryMb();
  const particles = flowField?.params?.particleCount ?? '—';

  statsEl.innerHTML = [
    `<div style="color:#90caf9;margin-bottom:2px">─ fps ─</div>`,
    row('now',     inst  > 0 ? inst.toFixed(0)  : '—', fpsColour(inst)),
    row('1s avg',  avg1  > 0 ? avg1.toFixed(1)  : '—', fpsColour(avg1)),
    row('5s avg',  avg5  > 0 ? avg5.toFixed(1)  : '—', fpsColour(avg5)),
    row('10s avg', avg10 > 0 ? avg10.toFixed(1) : '—', fpsColour(avg10)),
    row('min',     fpsMin < Infinity ? fpsMin.toFixed(1) : '—', '#ff5252'),
    row('max',     fpsMax > 0        ? fpsMax.toFixed(1) : '—', '#69f0ae'),
    `<div style="color:#90caf9;margin:3px 0 2px">─ load ─</div>`,
    row('DCL',     dcl  != null ? dcl  + ' ms' : '—'),
    row('load',    load != null ? load + ' ms' : '—'),
    row('FCP',     fcp  ? Math.round(fcp)  + ' ms' : '—'),
    row('LCP',     lcp  ? Math.round(lcp)  + ' ms' : '—'),
    `<div style="color:#90caf9;margin:3px 0 2px">─ resources ─</div>`,
    row('requests',  requests),
    row('transfer',  transferKb + ' KB'),
    mem ? row('JS heap', mem + ' MB') : '',
    row('particles', particles),
  ].join('');
}

// ── Public init ────────────────────────────────────────────────────────────

export function initBenchmark(flowField) {
  requestAnimationFrame(tick);
  const { stats } = createOverlay(flowField);
  setInterval(() => updateStats(stats, flowField), 250);

  // Exposed for automated capture: window.__bmSnapshot('notes') → CSV row string
  window.__bmSnapshot = (notes = '') => buildRow(notes, flowField);
}
