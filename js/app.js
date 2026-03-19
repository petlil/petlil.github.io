/**
 * app.js — Entry point. Imports and initialises all sections and core systems.
 *
 * `flowField` is exported so other components can reference the shared
 * particle array (flowField.particles) or live params (flowField.params).
 */

import { Router }                        from './core/Router.js';
import { EventBus }                      from './core/EventBus.js';
import { FlowField }                     from './sketches/FlowField.js';
import { SectionNav }                    from './components/SectionNav.js';
import { Identity }                      from './components/Identity.js';
import { SECTIONS }                      from './sections/index.js';
import { closeLightbox, isLightboxOpen } from './core/lightbox.js';

/** Shared instances — importable anywhere they're needed. */
export let flowField;

document.addEventListener('DOMContentLoaded', () => {
  // Guard: prevent double-mounting if this callback somehow fires twice
  const appEl = document.querySelector('#app');
  if (appEl.childElementCount > 0) return;

  // 1. Background flow field
  flowField = new FlowField(document.querySelector('#bg'));

  // 2. Section nav — centred name list with particle interaction
  new SectionNav(document.querySelector('#nav')).mount();

  // 3. Corner identity badge
  new Identity(document.querySelector('#identity')).mount();

  // 4. Build section panels dynamically from the SECTIONS config.
  //    To rename / add / reorder sections, edit js/sections/index.js only.
  const sectionEls = [];

  SECTIONS.forEach(({ slug, side, Component }) => {
    const el = document.createElement('section');
    el.id           = `section-${slug}`;
    el.className    = 'section';
    el.dataset.slug = slug;
    el.dataset.side = side;
    appEl.appendChild(el);
    sectionEls.push(el);
    new Component(el).mount();
  });

  // 5. Route → section visibility (slide-in via is-active class)
  EventBus.on('route', (slug) => {
    sectionEls.forEach(el => {
      el.classList.toggle('is-active', el.dataset.slug === slug);
    });
    // Drive mobile close button visibility via body class
    document.body.classList.toggle('panel-open', !!slug);
  });

  // 6. Router
  Router.init();

  // 7. Click anywhere on the background (canvas / empty space) to close the
  //    open panel. Clicks inside any UI element are ignored.
  document.addEventListener('click', (e) => {
    if (!Router.current()) return;
    const inUI = e.target.closest(
      '#app, #nav, #modal, #player, #identity, .ff-debug, .ff-debug-toggle, #mobile-close'
    );
    if (!inUI) Router.navigate('');
  });

  // 8b. Mobile close button — dismiss lightbox first if one is open,
  //     otherwise close the section panel.
  document.getElementById('mobile-close').addEventListener('click', () => {
    if (isLightboxOpen()) {
      closeLightbox();
    } else {
      Router.navigate('');
    }
  });

  // 8c. Swipe right on the panel to close it (or dismiss an open lightbox)
  let swipeTouchStartX = 0;
  let swipeTouchStartY = 0;
  let swipeTouchTarget = null;
  document.addEventListener('touchstart', (e) => {
    swipeTouchStartX = e.touches[0].clientX;
    swipeTouchStartY = e.touches[0].clientY;
    swipeTouchTarget  = e.target;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - swipeTouchStartX;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY;
    const isRightSwipe = dx > 60 && Math.abs(dx) > Math.abs(dy);
    if (!isRightSwipe) return;
    if (swipeTouchTarget?.closest('.card__gallery')) return;
    if (isLightboxOpen()) {
      closeLightbox();
    } else if (Router.current()) {
      Router.navigate('');
    }
  }, { passive: true });

  // 8. Global scroll redirect — wheel anywhere on the page scrolls the active
  //    section panel, so the user doesn't need to hover directly over it.
  //    If the cursor is already inside the active section, native scroll handles it.
  document.addEventListener('wheel', (e) => {
    const activeSection = document.querySelector('.section.is-active');
    if (!activeSection) return;
    if (e.target.closest('.section.is-active')) return;

    // Normalise deltaY to pixels (deltaMode: 0=px, 1=lines, 2=pages)
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    if (e.deltaMode === 2) delta *= activeSection.clientHeight;

    activeSection.scrollBy({ top: delta, left: 0 });
  }, { passive: true });

});
