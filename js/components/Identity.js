/**
 * Identity.js — Fixed corner badge: avatar, name, and Instagram link.
 *
 * Place your photo at assets/images/avatar.jpg.
 * The whole badge links to your Instagram profile.
 */

import { Component } from '../core/Component.js';

const INSTAGRAM_URL    = 'https://instagram.com/peterlileymusic';
const INSTAGRAM_HANDLE = '@peterlileymusic';
const DISPLAY_NAME     = 'Peter Liley';
const AVATAR_SRC       = 'assets/images/profile image.webp';

export class Identity extends Component {
  render() {
    return `
      <a class="identity"
         href="${INSTAGRAM_URL}"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="${DISPLAY_NAME} on Instagram">

        <div class="identity__avatar" aria-hidden="true">
          <img class="identity__photo"
               src="${AVATAR_SRC}"
               alt=""
               onerror="this.style.display='none'">
        </div>

        <div class="identity__text">
          <span class="identity__name">${DISPLAY_NAME}</span>
          <span class="identity__handle">
            <svg class="identity__ig-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4.5"/>
              <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/>
            </svg>
            ${INSTAGRAM_HANDLE}
          </span>
        </div>
      </a>
    `;
  }
}
