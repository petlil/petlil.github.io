import { Component } from '../core/Component.js';
import albums, { videos } from '../../data/music.js';

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
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}
      </div>
      <div class="card__video">
        <iframe
          src="${item.videoSrc}"
          allow="autoplay; encrypted-media"
          allowfullscreen
          loading="lazy"
          title="${item.title}"
        ></iframe>
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
      <img class="card__album-cover" src="${album.cover}" alt="${album.title}">
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

  audio.addEventListener('loadedmetadata', () => {
    scrubber.max = audio.duration;
  });

  audio.addEventListener('timeupdate', () => {
    scrubber.max   = audio.duration || 0;
    scrubber.value = audio.currentTime;
    timeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('ended', () => {
    btn.textContent    = '▶';
    scrubber.value     = 0;
    timeEl.textContent = '0:00';
  });

  scrubber.addEventListener('input', () => {
    audio.currentTime = scrubber.value;
  });
}

export class MusicSection extends Component {
  render() {
    return [
      ...videos.map(renderVideo),
      ...albums.map(renderAlbum),
    ].join('');
  }

  onMount() {
    this.el.querySelectorAll('.card__player').forEach(wirePlayer);
    this._wireLightbox();
  }

  _wireLightbox() {
    const modal = document.getElementById('modal');

    const open = (src, alt) => {
      modal.innerHTML = `<img class="modal__img" src="${src}" alt="${alt}">`;
      modal.classList.add('is-open');
    };

    const close = () => {
      modal.classList.remove('is-open');
      // Remove image after transition so it doesn't flash on next open
      modal.addEventListener('transitionend', () => { modal.innerHTML = ''; }, { once: true });
    };

    this.el.querySelectorAll('.card__album-cover').forEach(img => {
      img.addEventListener('click', () => open(img.src, img.alt));
    });

    modal.addEventListener('click', close);
  }
}
