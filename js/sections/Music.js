/**
 * Music.js — Music section panel.
 *
 * Renders each item from data/music.js as a rounded card containing
 * a Bandcamp or RNZ embed. When any embed is played, the page audio
 * player is paused via the window blur / postMessage mechanism in
 * js/core/mediaSync.js.
 */

import { Component } from '../core/Component.js';
import music from '../../data/music.js';

function renderCard(item) {
  const meta        = item.meta        ? `<p class="card__meta">${item.meta}</p>`        : '';
  const description = item.description ? `<div class="card__description">${item.description}</div>` : '';

  return `
    <article class="card" data-id="${item.id}">
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}
        ${description}
      </div>
      <div class="card__embed">
        <iframe
          src="${item.embedSrc}"
          height="${item.embedHeight}"
          allow="autoplay"
          loading="lazy"
          title="${item.title}"
        ></iframe>
      </div>
    </article>
  `;
}

export class MusicSection extends Component {
  render() {
    return music.map(renderCard).join('');
  }
}
