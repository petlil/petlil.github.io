// ─── config.js ────────────────────────────────────────────────────────────────
// Single source of truth for all layout, sizing, and performance values.
// Edit CONFIG.desktop or CONFIG.mobile to tune each breakpoint independently.
// All other JS files call getConfig() to get the active settings object.

const BREAKPOINT_MOBILE = 768; // px — matches CSS breakpoint

// ── Desktop config ────────────────────────────────────────────────────────────
const CONFIG = {

  desktop: {
    // Canvas population
    particleCount: 120,
    starCount:     200,

    // Nebula blob counts (fewer = lighter; more = richer but costlier)
    nebulaCrimsonBlobs: 5,
    nebulaPurpleBlobs:  4,
    nebulaBlueBlobs:    3,

    // Navigation nodes
    nodeRadius:      38,    // base circle radius (px)
    nodeClickRadius: 24,    // extra hit-area beyond radius
    nodes: [
      { xFrac: 0.22, yFrac: 0.34, label: 'Music',         id: 'music'         },
      { xFrac: 0.78, yFrac: 0.30, label: 'Artwork',        id: 'artwork'       },
      { xFrac: 0.19, yFrac: 0.71, label: 'Performances',   id: 'performances'  },
      { xFrac: 0.77, yFrac: 0.70, label: 'Installations',  id: 'installations' },
    ],

    // Label text sizes (px)
    nodeLabelSize:        11.5,
    nodeLabelHoveredSize: 13.5,

    // Identity text
    titleY:       0.115,   // fraction of canvas height
    titleSizeMin: 28,      // px lower clamp
    titleSizeMax: 46,      // px upper clamp
    titleSizeVW:  0.036,   // fraction of canvas width
    taglineSizeMin: 10.5,
    taglineSizeMax: 14,
    taglineSizeVW:  0.012,

    // Feature toggles
    showFrequencyRing:  true,
    showConstellations: true,

    // Particle mouse interaction
    mouseAttractionRadius:   180,
    mouseAttractionStrength: 0.22,
  },

  // ── Mobile config ───────────────────────────────────────────────────────────
  mobile: {
    // Canvas population — reduced for performance
    particleCount: 55,
    starCount:     110,

    // Fewer blobs for performance
    nebulaCrimsonBlobs: 3,
    nebulaPurpleBlobs:  2,
    nebulaBlueBlobs:    2,

    // Nodes — larger radius for finger touch targets; 2×2 grid layout
    nodeRadius:      46,
    nodeClickRadius: 30,
    nodes: [
      { xFrac: 0.25, yFrac: 0.30, label: 'Music',         id: 'music'         },
      { xFrac: 0.75, yFrac: 0.30, label: 'Artwork',        id: 'artwork'       },
      { xFrac: 0.25, yFrac: 0.62, label: 'Performances',   id: 'performances'  },
      { xFrac: 0.75, yFrac: 0.62, label: 'Installations',  id: 'installations' },
    ],

    // Slightly smaller labels to avoid crowding
    nodeLabelSize:        10,
    nodeLabelHoveredSize: 11,

    // Identity text — scaled down for portrait
    titleY:       0.10,
    titleSizeMin: 20,
    titleSizeMax: 34,
    titleSizeVW:  0.085,
    taglineSizeMin: 8.5,
    taglineSizeMax: 12,
    taglineSizeVW:  0.028,

    // Frequency ring is busy on small screens — keep it but smaller
    showFrequencyRing:  true,
    showConstellations: true,

    // Touch — shorter attraction radius
    mouseAttractionRadius:   120,
    mouseAttractionStrength: 0.18,
  },
};

// ── Active config accessor ────────────────────────────────────────────────────
// Called from setup() and windowResized(). Returns desktop or mobile config.
function getConfig() {
  return window.innerWidth < BREAKPOINT_MOBILE ? CONFIG.mobile : CONFIG.desktop;
}
