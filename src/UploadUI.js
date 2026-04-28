/**
 * UploadUI — Drop zone, preview dialog, and upload API calls
 *
 * Features:
 * - Drop zone UI: drag-and-drop + file picker button
 * - Preview dialog: shows image preview, ID field, category select (rings/charms), density/radius field
 * - Upload flow: file -> preview dialog -> confirm -> POST /api/upload -> POST /api/manifest -> onUpload callback
 * - Toast notification on success/error
 * - PNG-only validation
 *
 * Usage:
 *   const uploadUI = new UploadUI(containerElement, {
 *     serverUrl: 'http://localhost:3000',
 *     onUpload: (assetEntry) => { /* refresh sidebar *\/ }
 *   });
 */

export class UploadUI {

  /**
   * Create a new UploadUI instance.
   *
   * @param {HTMLElement} container  — DOM element to contain the drop zone
   * @param {Object} options       — { serverUrl, onUpload }
   */
  constructor(container, options = {}) {
    this.container = container;
    this.serverUrl = options.serverUrl || 'http://localhost:3000';
    this.onUpload = options.onUpload || null;

    // Track the currently selected file for preview
    this._pendingFile = null;
    this._pendingImageUrl = null;

    // Build the UI
    this._buildUI();
  }

  /**
   * Build the drop zone UI inside the container.
   * @private
   */
  _buildUI() {
    // Create drop zone element
    this._dropZone = document.createElement('div');
    this._dropZone.className = 'upload-drop-zone';
    this._dropZone.innerHTML = `
      <div class="upload-drop-content">
        <div class="upload-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="upload-text">Drop PNG here or</div>
        <button class="upload-browse-btn" type="button">Browse Files</button>
        <input type="file" class="upload-file-input" accept=".png,image/png" hidden>
      </div>
      <div class="upload-drop-overlay">Drop to upload</div>
    `;

    // Style the drop zone
    this._dropZone.style.cssText = `
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      background: #fafafa;
      transition: border-color 0.2s, background-color 0.2s;
      position: relative;
      cursor: pointer;
      user-select: none;
    `;

    const content = this._dropZone.querySelector('.upload-drop-content');
    content.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    `;

    const icon = this._dropZone.querySelector('.upload-icon');
    icon.style.cssText = 'color: #999;';

    const text = this._dropZone.querySelector('.upload-text');
    text.style.cssText = 'color: #666; font-size: 14px; margin: 0;';

    const browseBtn = this._dropZone.querySelector('.upload-browse-btn');
    browseBtn.style.cssText = `
      background: #7b2cbf;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;

    const overlay = this._dropZone.querySelector('.upload-drop-overlay');
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(123, 44, 191, 0.9);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 500;
      border-radius: 6px;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    `;

    // File input
    this._fileInput = this._dropZone.querySelector('.upload-file-input');

    // Event listeners
    this._fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this._handleFileSelect(file);
      }
    });

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._fileInput.click();
    });

    // Drop zone events
    this._dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._dropZone.style.borderColor = '#7b2cbf';
      this._dropZone.style.backgroundColor = '#f3e8ff';
      overlay.style.opacity = '1';
    });

    this._dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._dropZone.style.borderColor = '#ccc';
      this._dropZone.style.backgroundColor = '#fafafa';
      overlay.style.opacity = '0';
    });

    this._dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._dropZone.style.borderColor = '#ccc';
      this._dropZone.style.backgroundColor = '#fafafa';
      overlay.style.opacity = '0';

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this._handleFileSelect(files[0]);
      }
    });

    // Click on drop zone also opens file picker
    this._dropZone.addEventListener('click', () => {
      this._fileInput.click();
    });

    // Append to container
    this.container.appendChild(this._dropZone);

    // Create toast container (singleton, appended to body)
    this._ensureToastContainer();
  }

  /**
   * Ensure a toast container exists in the DOM.
   * @private
   */
  _ensureToastContainer() {
    let toastContainer = document.getElementById('upload-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'upload-toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      `;
      document.body.appendChild(toastContainer);
    }
    this._toastContainer = toastContainer;
  }

  /**
   * Show a toast notification.
   *
   * @param {string} message  — the message to display
   * @param {string} type     — 'success' or 'error'
   * @private
   */
  _showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#4caf50' : '#f44336';
    toast.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
      pointer-events: auto;
      animation: upload-toast-in 0.3s ease;
      max-width: 300px;
    `;
    toast.textContent = message;

    // Add animation keyframes if not already present
    if (!document.getElementById('upload-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'upload-toast-styles';
      style.textContent = `
        @keyframes upload-toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes upload-toast-out {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(20px); }
        }
      `;
      document.head.appendChild(style);
    }

    this._toastContainer.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'upload-toast-out 0.3s ease forwards';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Handle a file selection (from drop or file picker).
   *
   * @param {File} file  — the selected file
   * @private
   */
  _handleFileSelect(file) {
    // Validate PNG
    if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      this._showToast('PNG only. Please select a PNG file.', 'error');
      return;
    }

    this._pendingFile = file;

    // Create preview dialog
    this._showPreviewDialog(file);
  }

  /**
   * Show the preview dialog for a selected file.
   *
   * @param {File} file  — the file to preview
   * @private
   */
  _showPreviewDialog(file) {
    // Remove existing dialog if any
    this._closePreviewDialog();

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'upload-preview-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    // Create dialog box
    const dialog = document.createElement('div');
    dialog.className = 'upload-preview-dialog';
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

    // Image preview
    const previewUrl = URL.createObjectURL(file);
    this._pendingImageUrl = previewUrl;

    const preview = document.createElement('img');
    preview.src = previewUrl;
    preview.alt = 'Preview';
    preview.style.cssText = `
      width: 100%;
      max-height: 200px;
      object-fit: contain;
      border-radius: 4px;
      margin-bottom: 16px;
      background: #f0f0f0;
    `;

    // Form fields
    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    // ID field
    const idLabel = document.createElement('label');
    idLabel.textContent = 'ID';
    idLabel.style.cssText = 'font-size: 14px; font-weight: 500;';

    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.value = file.name.replace(/\.png$/i, '');
    idInput.style.cssText = `
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    `;

    // Category select
    const catLabel = document.createElement('label');
    catLabel.textContent = 'Category';
    catLabel.style.cssText = 'font-size: 14px; font-weight: 500;';

    const catSelect = document.createElement('select');
    catSelect.style.cssText = `
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    `;
    catSelect.innerHTML = `
      <option value="charms">Charms</option>
      <option value="rings">Rings</option>
    `;

    // Density field (for charms)
    const densityRow = document.createElement('div');
    densityRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    const densityLabel = document.createElement('label');
    densityLabel.textContent = 'Density';
    densityLabel.style.cssText = 'font-size: 14px; font-weight: 500;';

    const densityInput = document.createElement('input');
    densityInput.type = 'number';
    densityInput.value = '0.001';
    densityInput.step = '0.0001';
    densityInput.min = '0.0001';
    densityInput.style.cssText = `
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    `;

    densityRow.appendChild(densityLabel);
    densityRow.appendChild(densityInput);

    // Radius field (for rings)
    const radiusRow = document.createElement('div');
    radiusRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    const radiusLabel = document.createElement('label');
    radiusLabel.textContent = 'Radius';
    radiusLabel.style.cssText = 'font-size: 14px; font-weight: 500;';

    const radiusInput = document.createElement('input');
    radiusInput.type = 'number';
    radiusInput.value = '25';
    radiusInput.step = '1';
    radiusInput.min = '1';
    radiusInput.style.cssText = `
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    `;

    radiusRow.appendChild(radiusLabel);
    radiusRow.appendChild(radiusInput);

    // Update field visibility based on category
    const updateFieldVisibility = () => {
      if (catSelect.value === 'charms') {
        densityRow.style.display = 'flex';
        radiusRow.style.display = 'none';
      } else {
        densityRow.style.display = 'none';
        radiusRow.style.display = 'flex';
      }
    };
    catSelect.addEventListener('change', updateFieldVisibility);
    updateFieldVisibility();

    // Buttons
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => this._closePreviewDialog());

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Upload';
    confirmBtn.style.cssText = `
      padding: 8px 16px;
      background: #7b2cbf;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;

    // Handle upload
    confirmBtn.addEventListener('click', async () => {
      const id = idInput.value.trim();
      const category = catSelect.value;
      const density = parseFloat(densityInput.value) || 0.001;
      const radius = parseFloat(radiusInput.value) || 25;

      if (!id) {
        this._showToast('Please enter an ID', 'error');
        return;
      }

      // Disable button during upload
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Uploading...';
      cancelBtn.disabled = true;

      try {
        await this._uploadFile(file, id, category, density, radius);
        this._closePreviewDialog();
        this._showToast('Upload successful', 'success');

        // Call onUpload callback
        if (this.onUpload) {
          const entry = {
            id,
            file: `${category}/${id}.png`,
            ...(category === 'charms' ? { density } : { radius })
          };
          this.onUpload(entry);
        }
      } catch (err) {
        this._showToast(`Upload failed: ${err.message}`, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Upload';
        cancelBtn.disabled = false;
      }
    });

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(confirmBtn);

    // Assemble dialog
    form.appendChild(idLabel);
    form.appendChild(idInput);
    form.appendChild(catLabel);
    form.appendChild(catSelect);
    form.appendChild(densityRow);
    form.appendChild(radiusRow);
    form.appendChild(buttonRow);

    dialog.appendChild(preview);
    dialog.appendChild(form);
    overlay.appendChild(dialog);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._closePreviewDialog();
      }
    });

    // Store references for cleanup
    this._previewOverlay = overlay;
    this._confirmBtn = confirmBtn;
    this._cancelBtn = cancelBtn;

    // Show
    document.body.appendChild(overlay);
  }

  /**
   * Close the preview dialog.
   * @private
   */
  _closePreviewDialog() {
    if (this._previewOverlay) {
      document.body.removeChild(this._previewOverlay);
      this._previewOverlay = null;
    }
    if (this._pendingImageUrl) {
      URL.revokeObjectURL(this._pendingImageUrl);
      this._pendingImageUrl = null;
    }
    this._pendingFile = null;
  }

  /**
   * Upload a file to the server and update the manifest.
   *
   * @param {File} file       — the file to upload
   * @param {string} id       — the asset ID
   * @param {string} category — 'charms' or 'rings'
   * @param {number} density  — density value (for charms)
   * @param {number} radius   — radius value (for rings)
   * @returns {Promise<Object>} — the manifest entry that was added
   * @private
   */
  async _uploadFile(file, id, category, density, radius) {
    const filename = `${id}.png`;

    // Step 1: Upload the file
    const uploadUrl = `${this.serverUrl}/api/upload?category=${category}&filename=${filename}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'image/png'
      }
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || `Upload failed: ${uploadResponse.status}`);
    }

    // Step 2: Get current manifest
    const manifestResponse = await fetch(`${this.serverUrl}/api/manifest`);
    if (!manifestResponse.ok) {
      throw new Error('Failed to fetch manifest');
    }

    const manifest = await manifestResponse.json();

    // Step 3: Add new entry to manifest
    const entry = {
      id,
      file: `${category}/${filename}`,
      ...(category === 'charms' ? { density } : { radius })
    };

    if (category === 'charms') {
      manifest.charms.push(entry);
    } else {
      manifest.rings.push(entry);
    }

    // Step 4: Save updated manifest
    const saveResponse = await fetch(`${this.serverUrl}/api/manifest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(manifest)
    });

    if (!saveResponse.ok) {
      throw new Error('Failed to update manifest');
    }

    return entry;
  }

  /**
   * Destroy the UploadUI instance and clean up.
   */
  destroy() {
    this._closePreviewDialog();
    if (this._dropZone && this._dropZone.parentNode) {
      this._dropZone.parentNode.removeChild(this._dropZone);
    }
  }
}
