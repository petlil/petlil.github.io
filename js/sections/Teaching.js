/**
 * Teaching.js — Teaching section panel.
 *
 * Renders each item from data/education.js as a content card.
 */

import { Component } from '../core/Component.js';
import teaching from '../../data/education.js';

function renderCard(item) {
  const meta        = item.meta        ? `<p class="card__meta">${item.meta}</p>`              : '';
  const description = item.description ? `<div class="card__description">${item.description}</div>` : '';

  return `
    <article class="card" data-id="${item.id}">
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}
        ${description}
      </div>
    </article>
  `;
}

export class TeachingSection extends Component {
  render() {
    return teaching.map(renderCard).join('');
  }
}
