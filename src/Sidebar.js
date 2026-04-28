/**
 * Sidebar — Ring/charm picker UI with manifest-driven thumbnails
 *
 * Displays a scrollable list of ring and charm thumbnails loaded from
 * the server manifest. Clicking a thumbnail fires the appropriate callback.
 *
 * Usage:
 *   const sidebar = new Sidebar(document.getElementById('sidebar'), {
 *     onRingSelect: (ringEntry) => { ... },
 *     onCharmSelect: (charmEntry) => { ... },
 *   });
 *   await sidebar.loadManifest('http://localhost:3000');
 */

export class Sidebar {

  /**
   * Create a new Sidebar.
   *
   * @param {HTMLElement} container  — the root container element for the sidebar
   * @param {Object} options         — { onRingSelect, onCharmSelect }
   */
  constructor(container, options = {}) {
    /** @type {Function} called with a ring manifest entry when a ring thumbnail is clicked */
    this.onRingSelect = options.onRingSelect || (() => {});

    /** @type {Function} called with a charm manifest entry when a charm thumbnail is clicked */
    this.onCharmSelect = options.onCharmSelect || (() => {});

    /** @type {HTMLElement} */
    this.container = container;

    /** @type {{ rings: Array, charms: Array }} */
    this.manifest = { rings: [], charms: [] };

    /** @type {string} server URL used for image src URLs */
    this._serverUrl = 'http://localhost:3000';

    this._render();
  }

  /**
   * Load the asset manifest from the server and re-render thumbnails.
   *
   * @param {string} [serverUrl='http://localhost:3000']
   * @returns {Promise<void>}
   */
  async loadManifest(serverUrl = 'http://localhost:3000') {
    this._serverUrl = serverUrl;
    try {
      const res = await fetch(`${serverUrl}/api/manifest`);
      if (!res.ok) {
        console.error('Sidebar.loadManifest: failed to fetch manifest', res.status);
        return;
      }
      this.manifest = await res.json();
      this._render();
    } catch (err) {
      console.error('Sidebar.loadManifest: network error', err);
    }
  }

  /**
   * Re-render the sidebar content from the current manifest.
   * Preserves existing DOM structure; only updates the thumbnail grid.
   *
   * @private
   */
  _render() {
    const content = this.container.querySelector('#sidebar-content');
    if (!content) return;

    content.innerHTML = '';

    // --- Rings section ---
    if (this.manifest.rings && this.manifest.rings.length > 0) {
      const ringsSection = this._buildSection('Rings', this.manifest.rings, 'ring');
      content.appendChild(ringsSection);
    }

    // --- Charms section ---
    if (this.manifest.charms && this.manifest.charms.length > 0) {
      const charmsSection = this._buildSection('Charms', this.manifest.charms, 'charm');
      content.appendChild(charmsSection);
    }

    // Empty state
    if (
      (!this.manifest.rings || this.manifest.rings.length === 0) &&
      (!this.manifest.charms || this.manifest.charms.length === 0)
    ) {
      const empty = document.createElement('p');
      empty.textContent = 'No assets loaded.';
      empty.style.cssText = 'color: #999; font-size: 13px; text-align: center; padding: 16px 8px; margin: 0;';
      content.appendChild(empty);
    }
  }

  /**
   * Build a labelled section containing thumbnail items.
   *
   * @param {string} label         — section heading text
   * @param {Array}  items         — manifest entries for this section
   * @param {string} type          — 'ring' or 'charm'
   * @returns {HTMLElement}
   * @private
   */
  _buildSection(label, items, type) {
    const section = document.createElement('div');
    section.className = `sidebar-${type}-section`;

    const heading = document.createElement('h3');
    heading.textContent = label;
    heading.className = `sidebar-section-heading`;
    heading.style.cssText = `
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #999;
      margin: 0 0 8px 0;
    `;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = `sidebar-${type}-grid`;
    grid.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

    for (const item of items) {
      const thumb = this._buildThumbnail(item, type);
      grid.appendChild(thumb);
    }

    section.appendChild(grid);
    return section;
  }

  /**
   * Build a single thumbnail button for a ring or charm entry.
   *
   * @param {Object} item  — manifest entry { id, file, ... }
   * @param {string} type  — 'ring' or 'charm'
   * @returns {HTMLElement}
   * @private
   */
  _buildThumbnail(item, type) {
    const btn = document.createElement('button');
    btn.className = `sidebar-thumb-btn sidebar-thumb-${type}`;
    btn.type = 'button';
    btn.title = item.id;

    btn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      transition: border-color 0.15s, background-color 0.15s;
      width: 100%;
      text-align: left;
    `;

    // Image
    const img = document.createElement('img');
    const src = `${this._serverUrl}/${item.file}`;
    img.src = src;
    img.alt = item.id;
    img.className = `sidebar-thumb-img`;
    img.style.cssText = `
      width: 36px;
      height: 36px;
      object-fit: contain;
      border-radius: 4px;
      background: #f8f8f8;
      flex-shrink: 0;
    `;

    // Label
    const label = document.createElement('span');
    label.textContent = item.id;
    label.className = `sidebar-thumb-label`;
    label.style.cssText = `
      font-size: 13px;
      color: #444;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    btn.appendChild(img);
    btn.appendChild(label);

    // Hover states
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#7b2cbf';
      btn.style.backgroundColor = '#f9f0ff';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#e0e0e0';
      btn.style.backgroundColor = 'white';
    });

    // Click: call appropriate callback
    if (type === 'ring') {
      btn.addEventListener('click', () => this.onRingSelect(item));
    } else {
      btn.addEventListener('click', () => this.onCharmSelect(item));
    }

    return btn;
  }
}