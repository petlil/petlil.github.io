/**
 * lightbox.js — Shared image pop-out overlay.
 *
 * Call initLightbox(containerEl, selector) in a section's onMount().
 * The modal click-to-close listener is attached only once per page.
 */

const modal = document.getElementById('modal');
let listenerAttached = false;

function close() {
  modal.classList.remove('is-open');
  modal.addEventListener('transitionend', () => { modal.innerHTML = ''; }, { once: true });
}

/**
 * Wire lightbox open behaviour for all <img> elements matching `selector`
 * inside `containerEl`. Safe to call from multiple sections — the modal
 * close listener is attached only on the first call.
 *
 * @param {HTMLElement} containerEl
 * @param {string}      [selector='img']
 */
export function initLightbox(containerEl, selector = 'img') {
  if (!listenerAttached) {
    modal.addEventListener('click', close);
    listenerAttached = true;
  }

  containerEl.querySelectorAll(selector).forEach(img => {
    img.addEventListener('click', () => {
      modal.innerHTML = `<img class="modal__img" src="${img.src}" alt="${img.alt ?? ''}">`;
      modal.classList.add('is-open');
    });
  });
}
