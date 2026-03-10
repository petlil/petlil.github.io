/**
 * Education.js — Education section panel.
 *
 * Renders each item from data/education.js as a content card.
 */

import { Component } from '../core/Component.js';
import education from '../../data/education.js';

function renderCard(item) {
  const image       = item.image       ? `<img class="card__hero--full" src="${item.image}" alt="${item.title}" loading="lazy">` : '';
  const meta        = item.meta        ? `<p class="card__meta">${item.meta}</p>`              : '';
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
        ${meta}
        ${description}
        ${links}
      </div>
      ${photo}
    </article>
  `;
}

export class EducationSection extends Component {
  render() {
    return education.map(renderCard).join('');
  }
}
