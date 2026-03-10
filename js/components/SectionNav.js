/**
 * SectionNav.js — Left-side vertical list of section names.
 *
 * Clicking a button navigates via the hash Router and starts the particle
 * orbit around that word. Clicking the active button deselects it and
 * clears the orbit. The orbit follows the selected item, not hover.
 */

import { Component } from '../core/Component.js';
import { Router }    from '../core/Router.js';
import { EventBus }  from '../core/EventBus.js';
import { flowField } from '../app.js';
import { SECTIONS }  from '../sections/index.js';

export class SectionNav extends Component {
  render() {
    const items = SECTIONS.map(({ label, slug }) =>
      `<li>
        <button class="section-nav__item" data-slug="${slug}">${label}</button>
      </li>`
    ).join('');
    return `<ul class="section-nav" role="list">${items}</ul>`;
  }

  onMount() {
    this.$$('.section-nav__item').forEach(btn => {
      btn.addEventListener('click', () => {
        const active = btn.classList.contains('is-active');
        Router.navigate(active ? '' : btn.dataset.slug);
      });
    });

    // Orbit follows the active (selected) button, not hover
    EventBus.on('route', (slug) => {
      this.$$('.section-nav__item').forEach(btn => {
        const isActive = btn.dataset.slug === slug;
        btn.classList.toggle('is-active', isActive);
        if (isActive) {
          flowField?.setHoverRect(btn.getBoundingClientRect());
        }
      });
      // Clear orbit when nothing is selected
      if (!slug) flowField?.setHoverRect(null);
    });
  }
}
