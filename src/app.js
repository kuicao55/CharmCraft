/**
 * app.js — Charm DIY SPA entry point
 *
 * Wires together all modules and bootstraps the application:
 *   - PhysicsScene  — physics world and rendering
 *   - CharmManager  — charm body and constraint management
 *   - InteractionManager — mouse drag, select, delete
 *   - Sidebar       — ring/charm picker
 *   - UploadUI      — PNG upload drop zone
 *
 * Then calls scene.start() to begin the simulation.
 */

import { PhysicsScene }  from './PhysicsScene.js';
import { CharmManager }  from './CharmManager.js';
import { InteractionManager } from './InteractionManager.js';
import { PngToBody }     from './PngToBody.js';
import { Sidebar }       from './Sidebar.js';
import { UploadUI }      from './UploadUI.js';

const SERVER_URL = 'http://localhost:3000';

/**
 * Bootstrap the application.
 */
async function init() {
  // --- Canvas container ---
  const canvasContainer = document.getElementById('canvas-container');

  // --- Physics scene ---
  const scene = new PhysicsScene(canvasContainer, { width: 700, height: 600 });
  scene.start();

  // --- Charm manager (auto-registers with scene for replaceRing support) ---
  const charmManager = new CharmManager(scene);

  // --- Interaction manager ---
  const canvas = canvasContainer.querySelector('canvas');
  const interactionManager = new InteractionManager(scene, charmManager, canvas);

  // --- Toolbar: delete button ---
  const deleteBtn = document.getElementById('delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      interactionManager.deleteByToolbar();
    });
  }

  // --- Sidebar: ring/charm picker ---
  const sidebar = new Sidebar(document.getElementById('sidebar'), {
    /**
     * Ring thumbnail clicked — create a new static circle body
     * using the ring entry's radius and sprite, then replace the
     * scene's ring. All existing charm constraints are re-attached
     * automatically by CharmManager.reconnectAllConstraints().
     */
    onRingSelect: (ringEntry) => {
      const width  = scene.render.options.width;
      const radius = ringEntry.radius || 25;

      const newRing = Matter.Bodies.circle(width / 2, 60, radius, {
        isStatic: true,
        label: 'ring',
        render: {
          fillStyle: '#7b2cbf',
        },
      });

      // If the ring entry has an associated PNG asset, show it as a sprite
      if (ringEntry.file) {
        newRing.render.sprite.texture = `${SERVER_URL}/${ringEntry.file}`;
      }

      scene.replaceRing(newRing);
    },

    /**
     * Charm thumbnail clicked — load the PNG asset, draw to a hidden
     * canvas, extract the physics body via PngToBody, then add it
     * to the CharmManager which connects it to the ring with a spring.
     */
    onCharmSelect: async (charmEntry) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const scale = charmEntry.scale || 1.0;
        const density = charmEntry.density ?? 0.001;

        // Offscreen canvas for pixel reading
        const offscreen = document.createElement('canvas');
        offscreen.width  = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Create physics body from PNG contour
        const body = PngToBody.createBody(
          ctx,
          img.naturalWidth,
          img.naturalHeight,
          {
            x: scene.render.options.width  / 2,
            y: 140,
            scale,
            density,
            texturePath: `${SERVER_URL}/${charmEntry.file}`,
          }
        );

        // Add to scene — CharmManager adds it to the physics world
        // and creates a constraint connecting it to the ring.
        charmManager.addCharm(body, 80);
      };

      img.onerror = () => {
        console.error('Sidebar: failed to load charm image', charmEntry.file);
      };

      img.src = `${SERVER_URL}/${charmEntry.file}`;
    },
  });

  // --- Upload UI ---
  const uploadContainer = document.getElementById('upload-container');
  const uploadUI = new UploadUI(uploadContainer, {
    serverUrl: SERVER_URL,
    onUpload: (entry) => {
      // After a successful upload, refresh the sidebar so the
      // new asset appears in the picker immediately.
      sidebar.loadManifest(SERVER_URL);
    },
  });

  // --- Load initial manifest ---
  await sidebar.loadManifest(SERVER_URL);
}

init().catch(err => {
  console.error('App initialization failed:', err);
});