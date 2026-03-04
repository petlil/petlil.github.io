// ─── ui.js ────────────────────────────────────────────────────────────────────
// UISystem: manages the four content overlays and the artwork lightbox.
// Reads from PORTFOLIO (content.js) and renders HTML dynamically.

const uiSys = {
  isOpen:    false,
  currentId: null,

  // Call once from p5 setup() to wire up all close buttons and keyboard nav.
  init() {
    // Overlay close buttons
    document.querySelectorAll('.overlay-close').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // ESC closes overlay or lightbox
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const lb = document.getElementById('lightbox');
        if (lb && lb.classList.contains('active')) {
          this.closeLightbox();
        } else {
          this.close();
        }
      }
    });

    // Lightbox close button
    const lbClose = document.getElementById('lightbox-close');
    if (lbClose) lbClose.addEventListener('click', () => this.closeLightbox());

    // Click on dark lightbox backdrop (not the strip itself) to close
    const lb = document.getElementById('lightbox');
    if (lb) {
      lb.addEventListener('click', e => {
        if (e.target === lb) this.closeLightbox();
      });
    }
  },

  // ── Open / Close ──────────────────────────────────────────────────────────

  open(id) {
    const overlay = document.getElementById('overlay-' + id);
    if (!overlay) return;

    this.currentId = id;
    this.isOpen    = true;

    this._render(id, overlay);
    overlay.classList.add('active');
    overlay.scrollTop = 0;
    document.body.style.cursor = 'default';
  },

  close() {
    if (!this.isOpen) return;
    const overlay = document.getElementById('overlay-' + this.currentId);
    if (overlay) overlay.classList.remove('active');
    this.isOpen    = false;
    this.currentId = null;
  },

  // ── Content Rendering ─────────────────────────────────────────────────────

  _render(id, overlay) {
    const body = overlay.querySelector('.overlay-body');
    if (!body) return;

    switch (id) {
      case 'music':         body.innerHTML = this._renderMusic();        break;
      case 'artwork':       body.innerHTML = this._renderArtwork();      break;
      case 'performances':  body.innerHTML = this._renderPerformances(); break;
      case 'installations': body.innerHTML = this._renderInstallations();break;
    }

    // Wire artwork thumbnails after DOM insertion
    if (id === 'artwork') this._wireArtwork(body);
  },

  _renderMusic() {
    return PORTFOLIO.music.map(item => `
      <div class="music-item">
        <div class="music-embed">${item.embed}</div>
        <div class="music-info">
          ${item.featured ? '<span class="featured-tag">Featured Track</span>' : ''}
          <h2>${item.title}</h2>
          ${item.description  ? `<p>${item.description}</p>`  : ''}
          ${item.credit       ? `<p style="font-size:12px;opacity:0.5">${item.credit}</p>` : ''}
          ${item.review       ? `<p style="font-style:italic;font-size:12px;opacity:0.6;margin-top:12px">${item.review}</p>` : ''}
          ${item.reviewSource ? `<p style="font-size:12px;opacity:0.45;margin-top:4px">${item.reviewSource}</p>` : ''}
        </div>
      </div>
    `).join('');
  },

  _renderArtwork() {
    return `
      <div class="artwork-grid">
        ${PORTFOLIO.artwork.map(series => `
          <div class="artwork-series" data-series-id="${series.id}" role="button" tabindex="0"
               aria-label="View ${series.title}">
            <img src="${series.thumbnail}" alt="${series.title}" loading="lazy">
            <div class="artwork-series-label">${series.title}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _wireArtwork(container) {
    container.querySelectorAll('.artwork-series').forEach(el => {
      const activate = () => {
        const series = PORTFOLIO.artwork.find(s => s.id === el.dataset.seriesId);
        if (series) this.openLightbox(series);
      };
      el.addEventListener('click', activate);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
    });
  },

  _renderPerformances() {
    return PORTFOLIO.performances.map((item, i) => `
      <div class="performance-item${i % 2 === 1 ? ' flipped' : ''}">
        <div class="performance-embed">${item.embed}</div>
        <div class="performance-info">
          <h2>${item.title}</h2>
          ${item.description ? `<p>${item.description}</p>`                          : ''}
          ${item.credit      ? `<p style="opacity:0.55">${item.credit}</p>`          : ''}
          ${item.venue       ? `<p style="opacity:0.45;font-style:italic">${item.venue}</p>` : ''}
          ${item.date        ? `<p style="opacity:0.45">${item.date}</p>`            : ''}
        </div>
      </div>
    `).join('');
  },

  _renderInstallations() {
    return PORTFOLIO.installations.map(item => `
      <div class="installation-item">
        <div class="installation-embed">${item.embed}</div>
        <div class="installation-info">
          <h2>${item.title}</h2>
          ${item.description ? `<p>${item.description}</p>`                        : ''}
          ${item.year        ? `<p style="opacity:0.45;margin-top:10px">${item.year}</p>` : ''}
        </div>
      </div>
    `).join('');
  },

  // ── Artwork Lightbox ──────────────────────────────────────────────────────

  openLightbox(series) {
    const lb    = document.getElementById('lightbox');
    const strip = document.getElementById('lightbox-strip');
    const title = document.getElementById('lightbox-title');
    if (!lb || !strip) return;

    title.textContent = series.title;
    strip.innerHTML   = series.images
      .map(src => `<img src="${src}" alt="${series.title}" draggable="false" loading="lazy">`)
      .join('');

    lb.classList.add('active');
    strip.scrollLeft = 0;
  },

  closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('active');
  },
};
