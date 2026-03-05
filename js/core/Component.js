/**
 * Component.js — Base class for all UI components.
 *
 * Usage:
 *   class MyComponent extends Component {
 *     render() { return `<div>...</div>`; }
 *     onMount() { ... }   // optional
 *     onUnmount() { ... } // optional
 *   }
 *
 *   const c = new MyComponent(document.querySelector('#container'));
 *   c.mount();
 */
export class Component {
  /**
   * @param {HTMLElement} el - The root DOM element this component controls.
   */
  constructor(el) {
    this.el = el;
    this._mounted = false;
  }

  /**
   * Override in subclass — return an HTML string to inject into this.el.
   * @returns {string}
   */
  render() {
    return '';
  }

  /**
   * Renders and inserts HTML, then calls onMount.
   */
  mount() {
    this.el.innerHTML = this.render();
    this._mounted = true;
    this.onMount();
  }

  /**
   * Called after mount(). Override to attach events, start sketches, etc.
   */
  onMount() {}

  /**
   * Clears the element and calls onUnmount.
   */
  unmount() {
    this.onUnmount();
    this.el.innerHTML = '';
    this._mounted = false;
  }

  /**
   * Called before unmounting. Override to clean up listeners, sketches, etc.
   */
  onUnmount() {}

  /**
   * Convenience: query within this component's root element.
   * @param {string} selector
   * @returns {HTMLElement|null}
   */
  $(selector) {
    return this.el.querySelector(selector);
  }

  /**
   * Convenience: query all within this component's root element.
   * @param {string} selector
   * @returns {NodeList}
   */
  $$(selector) {
    return this.el.querySelectorAll(selector);
  }
}
