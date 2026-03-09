/**
 * Projects.js — Performances & installations section panel.
 *
 * Renders YouTube embeds in a 16:9 ratio container. YouTube embeds
 * include ?enablejsapi=1 so mediaSync.js can detect play events and
 * pause the page audio player automatically.
 */

import { Component } from '../core/Component.js';
import projects from '../../data/projects.js';

const ICONS = {
  instagram: `<svg class="card__link-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/></svg>`,
};

function renderCard(item) {
  const image       = item.image       ? `<img class="card__hero" src="${item.image}" alt="${item.title}" loading="lazy">` : '';
  const meta        = item.meta        ? `<p class="card__meta">${item.meta}</p>`                  : '';
  const description = item.description ? `<div class="card__description">${item.description}</div>` : '';
  const video       = item.videoSrc    ? `
      <div class="card__video">
        <iframe
          src="${item.videoSrc}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          loading="lazy"
          title="${item.title}"
        ></iframe>
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
      ${image}
      ${video}
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}
        ${description}
        ${links}
      </div>
    </article>
  `;
}

export class ProjectsSection extends Component {
  render() {
    return projects.map(renderCard).join('');
  }
}
