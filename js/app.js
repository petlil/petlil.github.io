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
// import { initBenchmark }                from './core/benchmark.js'; // BENCHMARK — remove with benchmark.js

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

  // BENCHMARK — remove this line along with the import above and benchmark.js
  // initBenchmark(flowField);

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

  // 8c. Touch gestures: background swipe-to-close + panel drag-to-close
  //
  // Panel drag-to-close: the active panel follows the finger horizontally.
  // Releasing past 50% of the panel width closes it; releasing before springs back.
  // Background swipe-to-close still works for touches outside the panel.

  let touchStartX       = 0, touchStartY = 0;
  let touchInScrollable = false;  // inside .card__gallery — excluded from both gestures
  let touchInSection    = false;  // inside active section — drag handles it, not swipe

  // Drag-to-close state
  let dcDirection = null;  // 'h' | 'v' | null — committed after DC_DIR_THRESHOLD px
  let dcDragging  = false; // true once we're in a rightward horizontal drag

  const DC_DIR_THRESHOLD = 8;   // px of movement before committing to a direction
  const DC_CLOSE_RATIO   = 0.5; // fraction of panel width that triggers close

  document.addEventListener('touchstart', (e) => {
    touchStartX       = e.touches[0].clientX;
    touchStartY       = e.touches[0].clientY;
    touchInScrollable = !!e.target.closest('.card__gallery');
    touchInSection    = !!e.target.closest('.section.is-active');
    dcDirection       = null;
    dcDragging        = false;
  }, { passive: true });

  // Non-passive so we can preventDefault during horizontal panel drags
  // (prevents vertical scroll fighting the horizontal drag)
  document.addEventListener('touchmove', (e) => {
    if (dcDirection === 'v') return;                      // committed to vertical — skip
    if (!dcDragging && !touchInSection) return;           // not a panel touch — skip
    if (!dcDragging && touchInScrollable) return;         // gallery touch — skip

    const sec = document.querySelector('.section.is-active');
    if (!sec) return;

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // Commit to a direction once movement exceeds threshold
    if (!dcDirection) {
      if (Math.abs(dx) < DC_DIR_THRESHOLD && Math.abs(dy) < DC_DIR_THRESHOLD) return;
      dcDirection = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (dcDirection === 'v') return;
    }

    if (dx <= 0) return; // only track rightward movement

    dcDragging = true;
    e.preventDefault(); // block scroll while dragging the panel sideways
    sec.style.transition = 'none';
    sec.style.transform  = `translateX(${dx}px)`;
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // ── Panel drag-to-close ──────────────────────────────────────────────────
    if (dcDragging) {
      dcDragging = false;
      const sec  = document.querySelector('.section.is-active');
      if (sec) {
        const panelW = sec.offsetWidth;
        if (dx > panelW * DC_CLOSE_RATIO) {
          // Animate the remaining distance out, then close via router
          const pct      = Math.min(dx / panelW, 1);
          const duration = Math.round((1 - pct) * 300); // shorter if nearly there
          sec.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          sec.style.transform  = 'translateX(100%)';
          setTimeout(() => {
            Router.navigate(''); // removes is-active; CSS now owns translateX(100%)
            sec.style.transition = '';
            sec.style.transform  = '';
          }, duration);
        } else {
          // Spring back — restore CSS transition then clear inline transform
          sec.style.transition = '';
          sec.style.transform  = '';
        }
      }
      return; // drag handled — skip swipe-to-close below
    }

    // ── Background swipe-to-close (touch started outside the panel) ──────────
    const isRightSwipe = dx > 60 && Math.abs(dx) > Math.abs(dy);
    if (!isRightSwipe || touchInScrollable || touchInSection) return;
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
