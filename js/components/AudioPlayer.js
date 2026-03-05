/**
 * AudioPlayer.js
 *
 * Pill-shaped audio player mounted to a container element.
 * Accepts an array of track objects { title, src } so all audio
 * files in assets/audio/ are navigable without editing JS.
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
const I_PREV  = `<svg viewBox="0 0 14 12" width="14" height="12" fill="currentColor"><polygon points="13,0 5,6 13,12"/><polygon points="7,0 0,6 7,12" opacity="0.45"/></svg>`;
const I_NEXT  = `<svg viewBox="0 0 14 12" width="14" height="12" fill="currentColor"><polygon points="1,0 9,6 1,12"/><polygon points="7,0 14,6 7,12" opacity="0.45"/></svg>`;

// ── helpers ───────────────────────────────────────────────────────────────

function fmt(sec) {
  if (!isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Encode a file-path src so spaces and special chars don't break Audio(). */
function encodeSrc(src) {
  return src.split('/').map(encodeURIComponent).join('/');
}

// ── AudioPlayer ───────────────────────────────────────────────────────────

export class AudioPlayer extends Component {
  /**
   * @param {HTMLElement}                    el     - container element
   * @param {{ title: string, src: string }[]} tracks - playlist from data/audio.js
   */
  constructor(el, tracks) {
    super(el);
    this.tracks    = tracks;
    this.trackIdx  = 0;
    this.audio     = null;
    this.audioCtx  = null;
    this.analyser  = null;   // exposed for FFTVisualiser
    this.isPlaying = false;
  }

  get currentTrack() { return this.tracks[this.trackIdx]; }

  render() {
    const { title } = this.currentTrack;
    const multi = this.tracks.length > 1;
    return `
      <div class="player-pill">
        ${multi ? `<button class="player-btn js-prev" title="Previous track">${I_PREV}</button>` : ''}
        <span class="player-title" title="${title}">${title}</span>
        <div class="player-controls">
          <button class="player-btn js-back"  title="Back ${SKIP_SEC}s">${I_BACK}</button>
          <button class="player-btn js-play"  title="Play">${I_PLAY}</button>
          <button class="player-btn js-fwd"   title="Forward ${SKIP_SEC}s">${I_FWD}</button>
        </div>
        <input type="range" class="player-seek" min="0" max="1000" step="1" value="0">
        <span class="player-time">0:00 / --:--</span>
        ${multi ? `<button class="player-btn js-next" title="Next track">${I_NEXT}</button>` : ''}
      </div>
    `;
  }

  onMount() {
    this._loadTrack(this.trackIdx);

    // Transport controls
    this.$('.js-play').addEventListener('click', () => this._togglePlay());
    this.$('.js-back').addEventListener('click', () => this._skip(-SKIP_SEC));
    this.$('.js-fwd' ).addEventListener('click', () => this._skip( SKIP_SEC));

    // Prev / next (only present when tracks.length > 1)
    this.$('.js-prev')?.addEventListener('click', () => this._changeTrack(-1));
    this.$('.js-next')?.addEventListener('click', () => this._changeTrack( 1));

    // Seek bar
    const seekEl = this.$('.player-seek');
    seekEl.addEventListener('input', () => {
      if (isFinite(this.audio.duration)) {
        this.audio.currentTime = (seekEl.value / 1000) * this.audio.duration;
      }
    });
  }

  // ── private ────────────────────────────────────────────────────────────

  _loadTrack(idx, autoplay = false) {
    const wasPlaying = autoplay || this.isPlaying;

    // Tear down previous audio element
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }

    this.trackIdx  = idx;
    this.isPlaying = false;

    const { title, src } = this.tracks[idx];
    this.audio = new Audio(encodeSrc(src));

    // Re-wire audio source into existing AudioContext if already initialised
    if (this.audioCtx) {
      const source = this.audioCtx.createMediaElementSource(this.audio);
      source.connect(this.analyser);
    }

    // Update UI
    const titleEl = this.$('.player-title');
    if (titleEl) { titleEl.textContent = title; titleEl.title = title; }
    this._resetSeek();

    // Wire events on the new element
    this.audio.addEventListener('timeupdate', () => this._onTimeUpdate());
    this.audio.addEventListener('play',  () => { this.isPlaying = true;  this._syncPlayBtn(); });
    this.audio.addEventListener('pause', () => { this.isPlaying = false; this._syncPlayBtn(); });
    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this._syncPlayBtn();
      this._resetSeek();
      // Auto-advance to next track, or loop back to the first
      if (this.trackIdx < this.tracks.length - 1) {
        this._changeTrack(1, true);
      } else {
        this._loadTrack(0, true);
      }
    });

    if (wasPlaying) this._togglePlay();
  }

  _changeTrack(delta, autoplay = false) {
    const next = this.trackIdx + delta;
    if (next < 0 || next >= this.tracks.length) return;
    this._loadTrack(next, autoplay);
  }

  async _togglePlay() {
    this._ensureAudioCtx();
    if (this.audio.paused) {
      try {
        await this.audio.play();
      } catch (err) {
        console.warn('AudioPlayer: play() rejected —', err.message);
      }
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
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return;
    }
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const source  = this.audioCtx.createMediaElementSource(this.audio);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize               = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
  }

  _onTimeUpdate() {
    const { currentTime, duration } = this.audio;
    const pct = isFinite(duration) && duration > 0
      ? (currentTime / duration) * 100 : 0;

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
    if (!seek) return;
    seek.value = 0;
    seek.style.background = '';
    const timeEl = this.$('.player-time');
    if (timeEl) timeEl.textContent = `0:00 / --:--`;
  }
}
