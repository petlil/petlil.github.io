# FlowField — p5.js Removal Benchmarks

Measured 2026-03-19. Test environment: Python static server (localhost:8022), macOS.
Browser: Chromium via Claude Preview MCP. Viewport: 650 × 786px (logical), DPR 2.

---

## Bundle size

| Asset | Raw | Gzipped |
|---|---|---|
| **Before** `p5.min.js` (CDN, blocking) | 1,056,654 B (1.01 MB) | 251,260 B **(245 KB)** |
| **After** all new sketch files combined | 67,138 B (65 KB) | ~12,559 B (noise+Layer+Vec2+Particle+FlowField) |

**Saving: ~1 MB raw / ~238 KB gzipped eliminated from initial load.**

New file breakdown:
| File | Raw bytes |
|---|---|
| `FlowField.js` | 52,605 |
| `Layer.js`     |  5,361 |
| `Particle.js`  |  4,042 |
| `noise.js`     |  3,532 |
| `Vec2.js`      |  1,598 |
| **Total**      | **67,138** |

---

## Page load time

Measured via `performance.getEntriesByType('navigation')[0]`.

| Metric | Before (with p5) | After (no p5) | Δ |
|---|---|---|---|
| `loadEventEnd` | 8,813 ms | 859 ms | **−7,954 ms** |
| `domContentLoadedEventEnd` | 312 ms | 206 ms | −106 ms |
| p5.js resource present | yes (blocking `<script>`) | **no** | — |

> Note: the large `loadEventEnd` difference is primarily because p5.js was a **render-blocking script**
> that had to fully download, parse, and execute before `DOMContentLoaded` fired, delaying
> everything downstream.

---

## Frame rate (FPS)

Measured via `requestAnimationFrame` timer over 120 frames.

| Scenario | Before | After |
|---|---|---|
| Idle (500 particles, 30 contour levels) | 121 FPS | 121 FPS |
| Active burst (~50 burst shapes on screen) | not measured | 120 FPS |

FPS is display-capped at 120 Hz in both cases. No regression under burst load.
The previous version also relied on native Canvas 2D for burst shapes (already migrated),
so the per-frame draw cost was already similar post-burst.

The primary gain is **eliminated CDN round-trip and parse time**, not per-frame throughput.

---

## What was replaced

| p5.js API | Replacement |
|---|---|
| `p.noise(x, y, z)` | Custom 3D Perlin noise in `noise.js` (80 lines, quintic fade) |
| `p5.Vector` | `Vec2` class in `Vec2.js` (60 lines, only used methods) |
| `new p5((p) => { ... }, el)` | Native `requestAnimationFrame` loop in `Layer.js` |
| `p.createCanvas / windowResized` | `canvas.width/height` + `window.addEventListener('resize', ...)` |
| `p.background / fill / stroke / line / rect` | Native 2D context (`fillStyle`, `strokeStyle`, `beginPath`, etc.) |
| `p.beginShape / curveVertex / endShape` | `catmullRomSpline()` helper (Catmull-Rom → cubic Bézier, 35 lines) |
| `p.mousePressed / touchStarted` | `canvas.addEventListener('mousedown' / 'touchstart', ...)` |
| `p.text / textSize / textAlign / ellipse` | Native `ctx.fillText`, `ctx.font`, `ctx.arc` |
| `p.push / pop` | `ctx.save / ctx.restore` |
