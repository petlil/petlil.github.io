/**
 * theme.js — Single source of truth for the site's colour palette.
 *
 * RGB arrays are used by p5.js sketches; hex strings mirror the same values
 * and are reflected in css/base.css as custom properties.
 *
 * Keep this file and base.css :root in sync whenever colours change.
 *
 * Usage (JS):
 *   import { theme } from '../core/theme.js';
 *   p.background(...theme.bg);
 *   p.stroke(...theme.particle);
 */
export const theme = {
  // ── core palette ──────────────────────────────────────────────────────────
  bg:       [222, 229, 229],   
  fg:       [8, 45, 15],    
  accent:   [23, 184, 144],   
  muted:    [157, 197, 187],  
  surface:  [222, 229, 229], 
  particle: [94, 128, 127],  
};
