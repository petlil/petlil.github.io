/**
 * AudioPlayer.js
 *
 * Pill-shaped audio player mounted to a container element.
 * Accepts an array of track objects { name, src } from data/audio.js.
 * Playlist is shuffled on every page load.
 *
 * Public API for other components:
 *   player.analyser   — AnalyserNode (null until first play)
 *   player.audio      — HTMLAudioElement
 *   player.isPlaying  — boolean
 */

import { Component } from '../core/Component.js';

// ── inline SVG icons ──────────────────────────────────────────────────────

const I_PLAY  = `<svg viewBox="0 0 10 12" width="11" height="13" fill="currentColor"><polygon points="0,0 10,6 0,12"/></svg>`;
const I_PAUSE = `<svg viewBox="0 0 10 12" width="11" height="13" fill="currentColor"><rect x="0" y="0" width="3.5" height="12" rx="0.5"/><rect x="6.5" y="0" width="3.5" height="12" rx="0.5"/></svg>`;
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

/** Fisher-Yates in-place shuffle. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── AudioPlayer ───────────────────────────────────────────────────────────

export class AudioPlayer extends Component {
  /**
   * @param {HTMLElement}                   el     - container element
   * @param {{ name: string, src: string }[]} tracks - playlist from data/audio.js
   */
  constructor(el, tracks) {
    super(el);
    // Shuffle a copy so the source array stays intact
    this.tracks    = shuffle([...tracks]);
    this.trackIdx  = 0;
    this.audio     = null;
    this.audioCtx  = null;
    this.analyser  = null;
    this.isPlaying = false;
    this._seeking  = false; // true while user is dragging the seek bar
  }

  get currentTrack() { return this.tracks[this.trackIdx]; }

  render() {
    const { name } = this.currentTrack;
    return `
      <div class="player-pill">
        <div class="player-controls">
          <button class="player-btn js-prev" title="Previous track">${I_PREV}</button>
          <button class="player-btn js-play" title="Play">${I_PLAY}</button>
          <button class="player-btn js-next" title="Next track">${I_NEXT}</button>
        </div>
        <span class="player-title">
          <span class="player-title__text" title="${name}">${name}</span>
        </span>
        <input type="range" class="player-seek" min="0" max="1000" step="1" value="0">
        <span class="player-time">0:00 / --:--</span>
      </div>
    `;
  }

  onMount() {
    this._loadTrack(this.trackIdx);
    this._initTitleScroll();

    this.$('.js-play').addEventListener('click', () => this._togglePlay());
    this.$('.js-prev').addEventListener('click', () => this._changeTrack(-1));
    this.$('.js-next').addEventListener('click', () => this._changeTrack( 1));

    // Seek bar — use pointerdown/up so timeupdate can't overwrite the
    // slider position while the user is dragging it.
    const seekEl = this.$('.player-seek');
    seekEl.addEventListener('pointerdown', () => { this._seeking = true; });
    seekEl.addEventListener('pointerup', () => {
      if (isFinite(this.audio.duration)) {
        this.audio.currentTime = (seekEl.value / 1000) * this.audio.duration;
      }
      this._seeking = false;
    });
    seekEl.addEventListener('pointercancel', () => { this._seeking = false; });
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

    const { name, src } = this.tracks[idx];
    this.audio = new Audio(encodeSrc(src));

    // Re-wire audio source into existing AudioContext if already initialised
    if (this.audioCtx) {
      const source = this.audioCtx.createMediaElementSource(this.audio);
      source.connect(this.analyser);
    }

    // Update UI
    const textEl = this.$('.player-title__text');
    if (textEl) { textEl.textContent = name; textEl.title = name; }
    this._resetSeek();
    this._initTitleScroll();

    // Wire events on the new element
    this.audio.addEventListener('timeupdate', () => this._onTimeUpdate());
    this.audio.addEventListener('play',  () => { this.isPlaying = true;  this._syncPlayBtn(); });
    this.audio.addEventListener('pause', () => { this.isPlaying = false; this._syncPlayBtn(); });
    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this._syncPlayBtn();
      this._resetSeek();
      // Auto-advance — wraps around to the first track after the last
      this._changeTrack(1, true);
    });

    if (wasPlaying) this._togglePlay();
  }

  _changeTrack(delta, autoplay = false) {
    const next = (this.trackIdx + delta + this.tracks.length) % this.tracks.length;
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

    // Don't overwrite the slider position while the user is dragging
    if (!this._seeking) {
      const seek = this.$('.player-seek');
      seek.value = (pct / 100) * 1000;
      seek.style.background =
        `linear-gradient(to right, var(--color-fg) ${pct}%, var(--color-border) ${pct}%)`;
    }

    this.$('.player-time').textContent = `${fmt(currentTime)} / ${fmt(duration)}`;
  }

  _syncPlayBtn() {
    const btn = this.$('.js-play');
    btn.innerHTML = this.isPlaying ? I_PAUSE : I_PLAY;
    btn.title     = this.isPlaying ? 'Pause' : 'Play';
  }

  /** Start a marquee scroll if the title text overflows its container. */
  _initTitleScroll() {
    const outer = this.$('.player-title');
    const inner = this.$('.player-title__text');
    if (!outer || !inner) return;

    // Reset any existing scroll state first
    outer.classList.remove('player-title--scroll');
    inner.style.removeProperty('--scroll-dist');

    // Measure after the browser has re-laid-out without the scroll class
    requestAnimationFrame(() => {
      const overflow = inner.scrollWidth - outer.clientWidth;
      if (overflow > 2) {
        inner.style.setProperty('--scroll-dist', `-${overflow + 16}px`);
        outer.classList.add('player-title--scroll');
      }
    });
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
