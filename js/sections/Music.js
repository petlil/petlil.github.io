import { Component }    from '../core/Component.js';
import { initLightbox } from '../core/lightbox.js';
import music from '../../data/music.js';

function formatTime(secs) {
  if (!isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderVideo(item) {
  const meta = item.meta ? `<p class="card__meta">${item.meta}</p>` : '';
  return `
    <article class="card" data-id="${item.id}">
      <div class="card__video">
        <iframe
          src="${item.videoSrc}"
          allow="autoplay; encrypted-media"
          allowfullscreen
          loading="lazy"
          title="${item.title}"
        ></iframe>
      </div>
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}
      </div>
    </article>
  `;
}

function renderAlbum(album) {
  const tracks = album.tracks.map((track, i) => {
    const num = String(i + 1).padStart(2, '0');
    return `
      <li class="card__track-row">
        <span class="card__track-num">${num}</span>
        <span class="card__track-name">${track.title}</span>
        <div class="card__player">
          <button class="card__play-btn" aria-label="Play">▶</button>
          <input class="card__scrubber" type="range" value="0" min="0" step="0.01">
          <span class="card__time">0:00</span>
          <audio preload="none" src="${track.file}"></audio>
        </div>
      </li>
    `;
  }).join('');

  return `
    <article class="card card--album" data-id="${album.id}">
      <img class="card__album-cover" src="${album.cover}" alt="${album.title}" loading="lazy">
      <div class="card__content">
        <h2 class="card__title">${album.title}</h2>
        ${album.description ? `<p class="card__meta">${album.description}</p>` : ''}
      </div>
      <ol class="card__tracklist">
        ${tracks}
      </ol>
    </article>
  `;
}

// All audio elements on the page — used to stop others when one starts.
const allAudios = [];

function wirePlayer(player) {
  const btn      = player.querySelector('.card__play-btn');
  const scrubber = player.querySelector('.card__scrubber');
  const timeEl   = player.querySelector('.card__time');
  const audio    = player.querySelector('audio');

  allAudios.push(audio);

  // ── Play / pause ──────────────────────────────────────────────────────────
  btn.addEventListener('click', () => {
    if (audio.paused) {
      allAudios.forEach(a => { if (a !== audio) a.pause(); });
      audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play',  () => { btn.textContent = '▐▐'; });
  audio.addEventListener('pause', () => { btn.textContent = '▶'; });
  audio.addEventListener('ended', () => {
    btn.textContent    = '▶';
    scrubber.value     = 0;
    timeEl.textContent = '0:00';
  });

  // ── Scrubber ──────────────────────────────────────────────────────────────
  // Use a dragging flag so timeupdate doesn't fight with the user's drag.
  let dragging = false;

  scrubber.addEventListener('pointerdown', () => { dragging = true; });

  // Listen on document so pointerup is caught even if released off the thumb
  document.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    audio.currentTime = Number(scrubber.value);
  });

  // Show time readout live while dragging, without moving the thumb back
  scrubber.addEventListener('input', () => {
    timeEl.textContent = formatTime(Number(scrubber.value));
  });

  audio.addEventListener('loadedmetadata', () => {
    scrubber.max = audio.duration;
  });

  audio.addEventListener('timeupdate', () => {
    if (dragging) return;           // don't fight the user's drag
    scrubber.max   = audio.duration || 0;
    scrubber.value = audio.currentTime;
    timeEl.textContent = formatTime(audio.currentTime);
  });
}

export class MusicSection extends Component {
  render() {
    return music.map(i => i.type === 'video' ? renderVideo(i) : renderAlbum(i)).join('');
  }

  onMount() {
    this.el.querySelectorAll('.card__player').forEach(wirePlayer);
    initLightbox(this.el, '.card__album-cover');
  }
}
