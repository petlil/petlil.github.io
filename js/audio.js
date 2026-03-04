// ─── audio.js ─────────────────────────────────────────────────────────────────
// AudioSystem: shuffled playlist + p5.sound FFT/Amplitude analysis.
// All methods that use p5.sound functions (FFT, Amplitude, loadSound) are safe
// to call only after p5's setup() has run — init() is called from there.

const audioSys = {
  tracks:       [],
  currentIndex: 0,
  sound:        null,
  fft:          null,
  amp:          null,
  playing:      false,
  loaded:       false,
  pendingPlay:  false,
  trackName:    '',
  _attemptCount: 0,

  // Call once from p5 setup() — sets up FFT and loads first track.
  init(trackList) {
    if (!trackList || trackList.length === 0) {
      _updatePlayerUI('', false);
      return;
    }

    this.tracks = this._shuffle([...trackList]);
    this.fft    = new p5.FFT(0.85, 64);
    this.amp    = new p5.Amplitude(0.8);

    this._load(0, 0);
  },

  // ── Internal ──────────────────────────────────────────────────────────────

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  _load(index, attempts) {
    // Guard: if every track failed to load, give up gracefully.
    if (attempts >= this.tracks.length) {
      console.warn('[audio] No tracks could be loaded — add MP3s to audio/');
      _updatePlayerUI('', false);
      return;
    }

    this.loaded    = false;
    this.trackName = this.tracks[index].title;
    _updatePlayerUI(this.trackName, false);

    if (this.sound) {
      this.sound.stop();
    }

    this.sound = loadSound(
      this.tracks[index].file,

      // success
      () => {
        this.loaded = true;
        this.sound.onended(() => this.next());

        if (this.pendingPlay) {
          this.sound.play();
          this.playing     = true;
          this.pendingPlay = false;
          _updatePlayerUI(this.trackName, true);
        }
      },

      // error — skip to next track
      () => {
        console.warn('[audio] Could not load:', this.tracks[index].file);
        const nextIndex = (index + 1) % this.tracks.length;
        this._load(nextIndex, attempts + 1);
      }
    );
  },

  // ── Playback controls (call from UI buttons) ───────────────────────────────

  play() {
    userStartAudio();                          // resolves browser autoplay policy
    if (this.loaded && this.sound) {
      this.sound.play();
      this.playing = true;
      _updatePlayerUI(this.trackName, true);
    } else {
      this.pendingPlay = true;                 // will auto-play once loaded
    }
  },

  pause() {
    if (this.sound && this.playing) {
      this.sound.pause();
      this.playing = false;
      _updatePlayerUI(this.trackName, false);
    }
  },

  toggle() {
    if (this.playing) this.pause();
    else              this.play();
  },

  next() {
    const wasPlaying     = this.playing;
    this.playing         = false;
    this.pendingPlay     = wasPlaying;
    this.currentIndex    = (this.currentIndex + 1) % this.tracks.length;
    this._load(this.currentIndex, 0);
  },

  prev() {
    const wasPlaying     = this.playing;
    this.playing         = false;
    this.pendingPlay     = wasPlaying;
    this.currentIndex    = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length;
    this._load(this.currentIndex, 0);
  },

  // ── Frequency data accessors (called every frame from sketch.js) ───────────

  // Returns full 64-bin spectrum array (values 0–255).
  getFFT() {
    if (!this.fft || !this.playing) return new Array(64).fill(0);
    return this.fft.analyze();
  },

  getBass()  { return (this.playing && this.fft) ? this.fft.getEnergy('bass')   : 0; },
  getMid()   { return (this.playing && this.fft) ? this.fft.getEnergy('mid')    : 0; },
  getHigh()  { return (this.playing && this.fft) ? this.fft.getEnergy('treble') : 0; },
  getLevel() { return (this.playing && this.amp) ? this.amp.getLevel()           : 0; },
};

// ── Player UI helper ───────────────────────────────────────────────────────────
// Called by audioSys internals and by sketch.js (updatePlayerViz).
function _updatePlayerUI(name, isPlaying) {
  const info = document.getElementById('track-info');
  const btn  = document.getElementById('btn-play-pause');

  if (info) {
    info.innerHTML = name
      ? `<span>${name}</span>`
      : `<span style="opacity:0.35">Add tracks to audio/ folder to activate</span>`;
  }

  if (btn) {
    // ⏸ pause symbol / ▶ play symbol
    btn.textContent = isPlaying ? '\u23F8' : '\u25B6';
  }
}
