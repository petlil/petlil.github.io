/**
 * AudioPlayer.js
 *
 * Pill-shaped audio player mounted to a container element.
 * Wraps a native <audio> element, builds a Web Audio API graph for FFT
 * analysis, and renders transport controls + a seekable progress bar.
 *
 * Public API for other components:
 *   player.analyser   — AnalyserNode (null until first play)
 *   player.audio      — HTMLAudioElement
 *   player.isPlaying  — boolean
 */

import { Component } from '../core/Component.js';

const SKIP_SEC = 10;

// ── inline SVG icons ──────────────────────────────────────────────────────

const I_PLAY = `<svg viewBox="0 0 10 12" width="11" height="13" fill="currentColor"><polygon points="0,0 10,6 0,12"/></svg>`;
const I_PAUSE = `<svg viewBox="0 0 10 12" width="11" height="13" fill="currentColor"><rect x="0" y="0" width="3.5" height="12" rx="0.5"/><rect x="6.5" y="0" width="3.5" height="12" rx="0.5"/></svg>`;
const I_BACK  = `<svg viewBox="0 0 13 12" width="13" height="12" fill="currentColor"><rect x="0" y="0" width="2.5" height="12" rx="0.5"/><polygon points="13,0 4,6 13,12"/></svg>`;
const I_FWD   = `<svg viewBox="0 0 13 12" width="13" height="12" fill="currentColor"><rect x="10.5" y="0" width="2.5" height="12" rx="0.5"/><polygon points="0,0 9,6 0,12"/></svg>`;

// ── helpers ───────────────────────────────────────────────────────────────

function fmt(sec) {
  if (!isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── AudioPlayer ───────────────────────────────────────────────────────────

export class AudioPlayer extends Component {
  /**
   * @param {HTMLElement} el  - container element
   * @param {string}      src - path to audio file
   */
  constructor(el, src) {
    super(el);
    this.src       = src;
    this.audio     = null;
    this.audioCtx  = null;
    this.analyser  = null;   // exposed for FFTVisualiser
    this.isPlaying = false;
  }

  render() {
    return `
      <div class="player-pill">
        <span class="player-title" title="${this.src.split('/').pop().replace(/\.[^.]+$/, '')}">
          ${this.src.split('/').pop().replace(/\.[^.]+$/, '')}
        </span>
        <div class="player-controls">
          <button class="player-btn js-back"  title="Back ${SKIP_SEC}s">${I_BACK}</button>
          <button class="player-btn js-play"  title="Play">${I_PLAY}</button>
          <button class="player-btn js-fwd"   title="Forward ${SKIP_SEC}s">${I_FWD}</button>
        </div>
        <input type="range" class="player-seek" min="0" max="1000" step="1" value="0">
        <span class="player-time">0:00 / --:--</span>
      </div>
    `;
  }

  onMount() {
    this.audio = new Audio(this.src);

    // Transport controls
    this.$('.js-play').addEventListener('click', () => this._togglePlay());
    this.$('.js-back').addEventListener('click', () => this._skip(-SKIP_SEC));
    this.$('.js-fwd' ).addEventListener('click', () => this._skip( SKIP_SEC));

    // Seek bar
    const seekEl = this.$('.player-seek');
    seekEl.addEventListener('input', () => {
      if (isFinite(this.audio.duration)) {
        this.audio.currentTime = (seekEl.value / 1000) * this.audio.duration;
      }
    });

    // Audio events
    this.audio.addEventListener('timeupdate', () => this._onTimeUpdate());
    this.audio.addEventListener('play',  () => { this.isPlaying = true;  this._syncPlayBtn(); });
    this.audio.addEventListener('pause', () => { this.isPlaying = false; this._syncPlayBtn(); });
    this.audio.addEventListener('ended', () => { this.isPlaying = false; this._syncPlayBtn(); this._resetSeek(); });
  }

  // ── private ────────────────────────────────────────────────────────────

  async _togglePlay() {
    this._ensureAudioCtx();
    if (this.audio.paused) {
      await this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  _skip(sec) {
    this.audio.currentTime = Math.max(0,
      Math.min(this.audio.duration || 0, this.audio.currentTime + sec));
  }

  _ensureAudioCtx() {
    if (this.audioCtx) {
      // Resume if suspended (browser autoplay policy)
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return;
    }
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const source   = this.audioCtx.createMediaElementSource(this.audio);
    this.analyser  = this.audioCtx.createAnalyser();
    this.analyser.fftSize              = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
  }

  _onTimeUpdate() {
    const { currentTime, duration } = this.audio;
    const pct = isFinite(duration) && duration > 0
      ? (currentTime / duration) * 100 : 0;

    // Update seek bar position and fill colour
    const seek = this.$('.player-seek');
    seek.value = (pct / 100) * 1000;
    seek.style.background =
      `linear-gradient(to right, var(--color-fg) ${pct}%, var(--color-border) ${pct}%)`;

    this.$('.player-time').textContent = `${fmt(currentTime)} / ${fmt(duration)}`;
  }

  _syncPlayBtn() {
    const btn = this.$('.js-play');
    btn.innerHTML = this.isPlaying ? I_PAUSE : I_PLAY;
    btn.title     = this.isPlaying ? 'Pause' : 'Play';
  }

  _resetSeek() {
    const seek = this.$('.player-seek');
    seek.value = 0;
    seek.style.background = '';
    this.$('.player-time').textContent = `0:00 / ${fmt(this.audio.duration)}`;
  }
}
