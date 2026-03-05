/**
 * EventBus.js — Simple publish/subscribe for decoupled component communication.
 *
 * Usage:
 *   EventBus.on('modal:open', (data) => { ... });
 *   EventBus.emit('modal:open', { content: '...' });
 *   EventBus.off('modal:open', handler);
 */

const listeners = new Map();

export const EventBus = {
  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
  },

  /**
   * Unsubscribe a handler from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },

  /**
   * Emit an event with optional data.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    listeners.get(event)?.forEach((fn) => fn(data));
  },
};
