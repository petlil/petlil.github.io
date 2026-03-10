/**
 * mediaSync.js — Pause the page audio player when external media starts.
 *
 * Two complementary detection strategies:
 *
 * 1. Window blur — when the user clicks into any iframe (YouTube, Bandcamp,
 *    RNZ, etc.) the browser shifts focus to the iframe and the window fires
 *    a 'blur' event. We pause the player at that point.
 *
 * 2. YouTube postMessage — YouTube iframes with ?enablejsapi=1 broadcast
 *    state-change events via postMessage. When state === 1 (playing) we
 *    pause the player even if the window didn't lose focus (e.g. auto-start).
 *
 * @param {import('../components/AudioPlayer.js').AudioPlayer} player
 */
export function initMediaSync(player) {
  if (!player) return;

  function pausePageMusic() {
    if (player.isPlaying) player.audio.pause();
  }

  // ── Strategy 1: window blur ──────────────────────────────────────────────
  // Fires whenever the user clicks inside any iframe.
  window.addEventListener('blur', () => {
    const active = document.activeElement;
    if (active && active.tagName === 'IFRAME') {
      pausePageMusic();
    }
  });

  // ── Strategy 2: YouTube postMessage ─────────────────────────────────────
  // YouTube sends JSON strings when enablejsapi=1 is in the embed URL.
  // State 1 = playing, state 2 = paused, state 0 = ended.
  window.addEventListener('message', (e) => {
    // Only handle messages that look like YouTube events
    if (!e.data || typeof e.data !== 'string') return;
    try {
      const msg = JSON.parse(e.data);
      if (msg.event === 'onStateChange' && msg.info === 1) {
        pausePageMusic();
      }
    } catch (_) {
      // Not JSON — ignore
    }
  });
}
