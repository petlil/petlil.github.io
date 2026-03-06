/**
 * app.js — Entry point. Imports and initialises all sections and core systems.
 *
 * `flowField` is exported so other components can reference the shared
 * particle array (flowField.particles) or live params (flowField.params).
 */

import { Router }        from './core/Router.js';
import { EventBus }      from './core/EventBus.js';
import { FlowField }     from './sketches/FlowField.js';
import { SectionNav }    from './components/SectionNav.js';
import { Identity }      from './components/Identity.js';
import { SECTIONS }      from './sections/index.js';

/** Shared instances — importable anywhere they're needed. */
export let flowField;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Background flow field
  flowField = new FlowField(document.querySelector('#bg'));

  // 2. Section nav — centred name list with particle interaction
  new SectionNav(document.querySelector('#nav')).mount();

  // 4b. Corner identity badge
  new Identity(document.querySelector('#identity')).mount();

  // 5. Build section panels dynamically from the SECTIONS config.
  //    To rename / add / reorder sections, edit js/sections/index.js only.
  const appEl = document.querySelector('#app');
  const sectionEls = [];

  SECTIONS.forEach(({ slug, side, Component }) => {
    const el = document.createElement('section');
    el.id          = `section-${slug}`;
    el.className   = 'section';
    el.dataset.slug = slug;
    el.dataset.side = side;
    appEl.appendChild(el);
    sectionEls.push(el);
    new Component(el).mount();
  });

  // 6. Route → section visibility (slide-in via is-active class)
  EventBus.on('route', (slug) => {
    sectionEls.forEach(el => {
      el.classList.toggle('is-active', el.dataset.slug === slug);
    });
  });

  // 7. Router
  Router.init();

  // 8. Click anywhere on the background (canvas / empty space) to close the
  //    open panel. Clicks inside any UI element are ignored.
  document.addEventListener('click', (e) => {
    if (!Router.current()) return; // nothing open, nothing to do
    const inUI = e.target.closest(
      '#app, #nav, #player, #identity, .ff-debug, .ff-debug-toggle'
    );
    if (!inUI) Router.navigate('');
  });
});
