/**
 * Router.js — Lightweight hash-based router.
 *
 * Sections register themselves with a slug. When the hash changes,
 * the router fires the matching handler and emits a route event
 * via EventBus.
 *
 * Usage:
 *   Router.register('music', () => { ... });
 *   Router.navigate('music');   // sets location.hash = '#music'
 *   Router.init();              // call once at app startup
 */

import { EventBus } from './EventBus.js';

const routes = new Map();
let currentSlug = null;

export const Router = {
  /**
   * Register a slug with a handler function.
   * @param {string} slug
   * @param {Function} handler
   */
  register(slug, handler) {
    routes.set(slug, handler);
  },

  /**
   * Navigate to a slug programmatically.
   * @param {string} slug
   */
  navigate(slug) {
    location.hash = slug;
  },

  /**
   * Return the current slug.
   * @returns {string|null}
   */
  current() {
    return currentSlug;
  },

  /**
   * Initialise — listens for hashchange and fires the initial route.
   * Call once in app.js.
   */
  init() {
    const resolve = () => {
      const slug = location.hash.replace('#', '') || null;
      if (slug === currentSlug) return;
      currentSlug = slug;

      if (slug && routes.has(slug)) {
        routes.get(slug)(slug);
      }

      EventBus.emit('route', slug);
    };

    window.addEventListener('hashchange', resolve);
    resolve();
  },
};
