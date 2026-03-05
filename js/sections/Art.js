/**
 * Art.js — Art section panel.
 *
 * Standalone images render as full-width image cards.
 * Collections render with a cover image and an expand button that
 * reveals a horizontally-scrollable strip of all images in the series.
 */

import { Component } from '../core/Component.js';
import art from '../../data/art.js';

function renderImageCard(item) {
  const title = item.title ? `<div class="card__content"><p class="card__meta">${item.title}</p></div>` : '';
  return `
    <article class="card card--image" data-id="${item.id}">
      <img class="card__image" src="${item.src}" alt="${item.title || ''}" loading="lazy">
      ${title}
    </article>
  `;
}

function renderCollectionCard(item) {
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
      <div class="card__gallery" data-gallery="${item.id}">
        ${thumbs}
      </div>
    </article>
  `;
}

export class ArtSection extends Component {
  render() {
    return art.map(item =>
      item.type === 'collection' ? renderCollectionCard(item) : renderImageCard(item)
    ).join('');
  }

  onMount() {
    // Toggle horizontal gallery strip on expand button click
    this.$$('.card__expand-btn').forEach(btn => {
      const id      = btn.dataset.collection;
      const gallery = this.$(`[data-gallery="${id}"]`);
      if (!gallery) return;

      btn.addEventListener('click', () => {
        const open = gallery.classList.toggle('is-open');
        btn.textContent = open
          ? `Hide series`
          : `View series (${gallery.querySelectorAll('img').length})`;
      });
    });
  }
}
