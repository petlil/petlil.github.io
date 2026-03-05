/**
 * Projects.js — Performances & installations section panel.
 *
 * Renders YouTube embeds in a 16:9 ratio container. YouTube embeds
 * include ?enablejsapi=1 so mediaSync.js can detect play events and
 * pause the page audio player automatically.
 */

import { Component } from '../core/Component.js';
import projects from '../../data/projects.js';

function renderCard(item) {
  const meta        = item.meta        ? `<p class="card__meta">${item.meta}</p>`              : '';
  const description = item.description ? `<div class="card__description">${item.description}</div>` : '';

  return `
    <article class="card" data-id="${item.id}">
      <div class="card__video">
        <iframe
          src="${item.videoSrc}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          loading="lazy"
          title="${item.title}"
        ></iframe>
      </div>
      <div class="card__content">
        <h2 class="card__title">${item.title}</h2>
        ${meta}
        ${description}
      </div>
    </article>
  `;
}

export class ProjectsSection extends Component {
  render() {
    return projects.map(renderCard).join('');
  }
}
