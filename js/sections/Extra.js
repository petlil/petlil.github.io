/**
 * Extra.js — Temporary performance-test section.
 * Contains a copy of every card from every section, backed by duplicated
 * media in assets/extra/.
 *
 * TO REMOVE:
 *   1. Delete  js/sections/Extra.js
 *   2. Delete  data/extra.js
 *   3. Delete  assets/extra/
 *   4. Remove  the 'extra' entry from js/sections/index.js
 */

import { Component }    from '../core/Component.js';
import { initLightbox } from '../core/lightbox.js';
import {
  extraVideos,
  extraAlbums,
  extraArt,
  extraEducation,
  extraProjects,
} from '../../data/extra.js';

// ── Shared helpers ─────────────────────────────────────────────────────────

function formatTime(secs) {
  if (!isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const ICONS = {
  instagram: `<svg class="card__link-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/></svg>`,
};

// ── Render functions ───────────────────────────────────────────────────────

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
      </li>`;
  }).join('');
  return `
    <article class="card card--album" data-id="${album.id}">
      <img class="card__album-cover" src="${album.cover}" alt="${album.title}" loading="lazy">
      <div class="card__content">
        <h2 class="card__title">${album.title}</h2>
        ${album.description ? `<p class="card__meta">${album.description}</p>` : ''}
      </div>
      <ol class="card__tracklist">${tracks}</ol>
    </article>`;
}

function renderVideo(item) {
  const meta = item.meta ? `<p class="card__meta">${item.meta}</p>` : '';
  return `
    <article class="card" data-id="extra-${item.id}">
      <div class="card__video">
        <iframe src="${item.videoSrc}" allow="autoplay; encrypted-media" allowfullscreen loading="lazy" title="${item.title}"></iframe>
      </div>
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}
      </div>
    </article>`;
}

function renderArtItem(item) {
  if (item.type === 'collection') {
    const thumbs = item.images.map(src =>
      `<img src="${src}" alt="" loading="lazy" draggable="false">`
    ).join('');
    return `
      <article class="card card--collection" data-id="${item.id}">
        <img class="card__image" src="${item.cover}" alt="${item.title}" loading="lazy">
        <div class="card__content">
          <h2 class="card__title">${item.title}</h2>
          <button class="card__expand-btn" data-collection="${item.id}">
            View series (${item.images.length})
          </button>
        </div>
        <div class="card__gallery" data-gallery="${item.id}">${thumbs}</div>
      </article>`;
  }
  const title = item.title ? `<div class="card__content"><p class="card__meta">${item.title}</p></div>` : '';
  return `
    <article class="card card--image" data-id="${item.id}">
      <img class="card__image" src="${item.src}" alt="${item.title || ''}" loading="lazy">
      ${title}
    </article>`;
}

function renderEducationCard(item) {
  const image       = item.image       ? `<img class="card__hero--full" src="${item.image}" alt="${item.title}" loading="lazy">` : '';
  const meta        = item.meta        ? `<p class="card__meta">${item.meta}</p>` : '';
  const description = item.description ? `<div class="card__description">${item.description}</div>` : '';
  const links       = item.links?.length ? `
      <div class="card__links">
        ${item.links.map(l => `<a class="card__link" href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join('')}
      </div>` : '';
  const photo       = item.photo       ? `<img class="card__description-photo" src="${item.photo}" alt="${item.title}" loading="lazy">` : '';
  return `
    <article class="card" data-id="${item.id}">
      ${image}
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}${description}${links}
      </div>
      ${photo}
    </article>`;
}

function renderProjectCard(item) {
  const image       = item.image    ? `<img class="card__hero" src="${item.image}" alt="${item.title}" loading="lazy">` : '';
  const meta        = item.meta     ? `<p class="card__meta">${item.meta}</p>` : '';
  const description = item.description ? `<div class="card__description">${item.description}</div>` : '';
  const video       = item.videoSrc ? `
      <div class="card__video">
        <iframe src="${item.videoSrc}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" title="${item.title}"></iframe>
      </div>` : '';
  const links       = item.links?.length ? `
      <div class="card__links">
        ${item.links.map(l => {
          const icon = l.icon && ICONS[l.icon] ? ICONS[l.icon] : '';
          const cls  = l.icon ? `card__link card__link--${l.icon}` : 'card__link';
          return `<a class="${cls}" href="${l.href}" target="_blank" rel="noopener noreferrer">${icon}${l.label}</a>`;
        }).join('')}
      </div>` : '';
  return `
    <article class="card" data-id="${item.id}">
      ${image}${video}
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}${description}${links}
      </div>
    </article>`;
}

// ── Audio player wiring ────────────────────────────────────────────────────

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
  audio.addEventListener('ended', () => {
    btn.textContent    = '▶';
    scrubber.value     = 0;
    timeEl.textContent = '0:00';
  });

  let dragging = false;
  scrubber.addEventListener('pointerdown', () => { dragging = true; });
  document.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    audio.currentTime = Number(scrubber.value);
  });
  scrubber.addEventListener('input', () => {
    timeEl.textContent = formatTime(Number(scrubber.value));
  });
  audio.addEventListener('loadedmetadata', () => { scrubber.max = audio.duration; });
  audio.addEventListener('timeupdate', () => {
    if (dragging) return;
    scrubber.max       = audio.duration || 0;
    scrubber.value     = audio.currentTime;
    timeEl.textContent = formatTime(audio.currentTime);
  });
}

// ── Section component ──────────────────────────────────────────────────────

export class ExtraSection extends Component {
  render() {
    return [
      ...extraAlbums.map(renderAlbum),
      ...extraVideos.map(renderVideo),
      ...extraArt.map(renderArtItem),
      ...extraEducation.map(renderEducationCard),
      ...extraProjects.map(renderProjectCard),
    ].join('');
  }

  onMount() {
    this.el.querySelectorAll('.card__player').forEach(wirePlayer);

    this.$$('.card__expand-btn').forEach(btn => {
      const gallery = this.$(`[data-gallery="${btn.dataset.collection}"]`);
      if (!gallery) return;
      btn.addEventListener('click', () => {
        const open = gallery.classList.toggle('is-open');
        btn.textContent = open
          ? 'Hide series'
          : `View series (${gallery.querySelectorAll('img').length})`;
      });
    });

    initLightbox(this.el, '.card__image, .card__gallery img, .card__album-cover');
  }
}
