/**
 * FFTVisualiser.js
 *
 * A p5 instance-mode sketch that renders real-time frequency bars for
 * whatever AudioPlayer is passed in.
 *
 * Usage:
 *   const vis = new FFTVisualiser(
 *     document.querySelector('#visualiser'),
 *     audioPlayer
 *   );
 *
 * The canvas is transparent — it overlays the FlowField background.
 * pointer-events: none is set on the container in CSS.
 *
 * Bars are centred on screen and mirror vertically (symmetric waveform style).
 * Frequency bins are mapped semi-logarithmically so bass has more columns.
 */

import { theme } from '../core/theme.js';

const BAR_COUNT   = 80;
const BAR_W       = 4;     // px
const BAR_GAP     = 3;     // px
const MAX_H_RATIO = 0.22;  // max bar half-height as fraction of viewport height

export class FFTVisualiser {
  /**
   * @param {HTMLElement}  containerEl  - mount target (position:fixed, full screen)
   * @param {AudioPlayer}  audioPlayer  - exposes .analyser (AnalyserNode | null)
   */
  constructor(containerEl, audioPlayer) {
    this.container   = containerEl;
    this.audioPlayer = audioPlayer;
    this._dataArray  = null;
    this._sketch     = null;
    this._initSketch();
  }

  _initSketch() {
    this._sketch = new p5((p) => {

      p.setup = () => {
        const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
        cnv.style('display', 'block');
        p.noSmooth(); // crisp bars
      };

      p.draw = () => {
        p.clear(); // transparent background every frame

        const analyser = this.audioPlayer.analyser;
        if (!analyser) return;

        // Lazily create the data buffer
        if (!this._dataArray) {
          this._dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(this._dataArray);

        const bins   = analyser.frequencyBinCount;
        const totalW = BAR_COUNT * (BAR_W + BAR_GAP) - BAR_GAP;
        const startX = (p.width  - totalW) / 2;
        const midY   = p.height  / 2;
        const maxH   = p.height  * MAX_H_RATIO;

        p.noStroke();

        for (let i = 0; i < BAR_COUNT; i++) {
          // Semi-log frequency mapping: compress high-frequency bins
          // so bass/mid occupy more columns, treble fewer.
          const t      = Math.pow(i / BAR_COUNT, 1.6);
          const binIdx = Math.floor(t * bins * 0.55); // upper 45% is silent/noise
          const amp    = this._dataArray[binIdx] / 255; // 0..1

          const h     = amp * maxH;
          const x     = startX + i * (BAR_W + BAR_GAP);

          // Alpha scales with amplitude for a subtle appearance when quiet
          const alpha = 30 + amp * 225;
          p.fill(...theme.accent, alpha);

          // Symmetric: bar extends up AND down from centre line
          p.rect(x, midY - h, BAR_W, h * 2, 1);
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

    }, this.container);
  }

  destroy() {
    this._sketch.remove();
  }
}
