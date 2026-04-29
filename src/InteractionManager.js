/**
 * InteractionManager — Mouse interaction for charm picking, drag, select, and delete
 *
 * Provides MouseConstraint for dragging charms, click-to-select highlighting,
 * and Delete key / toolbar delete for charm removal.
 *
 * Dependencies (loaded as globals via CDN <script> tags):
 *   - Matter   (matter-js)
 *
 * Dependencies (injected instances):
 *   - PhysicsScene  (scene)
 *   - CharmManager   (charmManager)
 *   - HTMLCanvasElement (canvas)
 */

export class InteractionManager {

  /**
   * Create a new InteractionManager.
   *
   * @param {PhysicsScene} scene            — the physics scene
   * @param {CharmManager} charmManager     — the charm manager
   * @param {HTMLCanvasElement} canvas     — the render canvas
   */
  constructor(scene, charmManager, canvas) {
    this.scene = scene;
    this.charmManager = charmManager;
    this.canvas = canvas;

    /** @type {Matter.Body|null} Currently selected charm body */
    this.selectedCharm = null;

    /** @type {Function|null} Callback fired after toolbar delete */
    this.onDelete = null;

    // Create Matter.js mouse and mouse constraint
    const mouse = Matter.Mouse.create(canvas);
    this.mouseConstraint = Matter.MouseConstraint.create(scene.engine, {
      mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false,
        },
      },
    });

    // Add mouse constraint itself to the world (not its body, which is null)
    Matter.Composite.add(scene.engine.world, this.mouseConstraint);

    // Track constraint to re-attach after drag (bodyA=ring, bodyB=charm)
    this._draggedConstraint = null;

    /** @type {Function|null} Per-drag mouseup fallback listener */
    this._onMouseUp = null;

    // Fallback: if user switches tabs, re-attach
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this._reattachIfDragging();
    });

    // --- mousedown: select / deselect ---
    Matter.Events.on(this.mouseConstraint, 'mousedown', (event) => {
      const body = event.body;

      if (body && this._isCharmBody(body)) {
        this._selectCharm(body);
      } else {
        this._deselectCharm();
      }
    });

    // --- startdrag: remove constraint so charm moves freely ---
    Matter.Events.on(this.mouseConstraint, 'startdrag', (event) => {
      const body = event.body;
      if (!body || !this._isCharmBody(body)) {
        return;
      }

      // Find the constraint for this charm
      const constraintIndex = this.charmManager.constraints.findIndex(
        c => c.bodyB.id === body.id
      );

      if (constraintIndex !== -1) {
        this._draggedConstraint = this.charmManager.constraints[constraintIndex];
        this._draggedConstraint.isDragging = true;

        // Remove from physics world (keep it tracked in CharmManager)
        Matter.Composite.remove(this.scene.engine.world, this._draggedConstraint);

        // Register per-drag fallback: re-attach if mouseup fires outside canvas
        window.addEventListener('mouseup', this._onMouseUp = () => this._reattachIfDragging());
      }
    });

    // --- enddrag: re-constrain charm back to ring ---
    Matter.Events.on(this.mouseConstraint, 'enddrag', () => {
      // Clean up per-drag mouseup fallback
      window.removeEventListener('mouseup', this._onMouseUp);
      this._onMouseUp = null;

      if (!this._draggedConstraint) {
        return;
      }

      this._draggedConstraint.isDragging = false;

      // Guard: only re-add if still tracked in CharmManager and bodyB is in the world.
      // If the charm was deleted during drag, bodyB is gone and re-adding would be invalid.
      const isStillTracked = this.charmManager.constraints.includes(this._draggedConstraint);
      const bodyBInWorld = Matter.Composite.get(this.scene.engine.world, this._draggedConstraint.bodyB.id, 'body');

      const alreadyInWorld = Matter.Composite.get(this.scene.engine.world, this._draggedConstraint.id, 'constraint');

      if (isStillTracked && bodyBInWorld && !alreadyInWorld) {
        // Re-point bodyA to the current ring (handles replaceRing)
        this._draggedConstraint.bodyA = this.scene.ring;

        // Add back to physics world
        Matter.Composite.add(this.scene.engine.world, this._draggedConstraint);
      }

      this._draggedConstraint = null;
    });

    // --- keydown: Delete key removes selected charm (skip when typing in input fields) ---
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        this._deleteSelected();
      }
    });

    // --- drag-outside-delete: remove charm when dragged off canvas ---
    this.canvas.addEventListener('mouseleave', () => {
      if (!this._draggedConstraint) return;
      const bodyId = this._draggedConstraint.bodyB.id;
      const body = Matter.Composite.get(this.scene.engine.world, bodyId, 'body');
      if (body) {
        // Break the draggedConstraint reference so enddrag won't re-add
        this._draggedConstraint = null;
        // Remove body (constraint will be orphaned and also removed by CharmManager)
        Matter.Composite.remove(this.scene.engine.world, body);
        // Also remove from charmManager's tracking
        this.charmManager.removeCharm(bodyId);
        this.selectedCharm = null;
      }
    });
  }

  /**
   * Re-attach the dragged constraint if drag ended outside the canvas.
   * Called as a fallback when the native enddrag event never fires.
   *
   * @private
   */
  _reattachIfDragging() {
    // Clean up per-drag mouseup fallback
    if (this._onMouseUp) {
      window.removeEventListener('mouseup', this._onMouseUp);
      this._onMouseUp = null;
    }

    if (this._draggedConstraint) {
      const isStillTracked = this.charmManager.constraints.includes(this._draggedConstraint);
      const bodyBInWorld = Matter.Composite.get(this.scene.engine.world, this._draggedConstraint.bodyB.id, 'body');
      if (isStillTracked && bodyBInWorld) {
        const alreadyInWorld = Matter.Composite.get(this.scene.engine.world, this._draggedConstraint.id, 'constraint');
        if (!alreadyInWorld) {
          this._draggedConstraint.bodyA = this.scene.ring;
          Matter.Composite.add(this.scene.engine.world, this._draggedConstraint);
        }
      }
      this._draggedConstraint.isDragging = false;
      this._draggedConstraint = null;
    }
  }

  /**
   * Check whether a body is a charm body managed by CharmManager.
   *
   * @param {Matter.Body} body
   * @returns {boolean}
   */
  _isCharmBody(body) {
    return this.charmManager.constraints.some(c => c.bodyB.id === body.id);
  }

  /**
   * Highlight a charm body and mark it as selected.
   *
   * @param {Matter.Body} body
   */
  _selectCharm(body) {
    this._deselectCharm(); // clear previous selection first

    body.render.strokeStyle = '#ff6b6b';
    body.render.lineWidth = 3;
    this.selectedCharm = body;
  }

  /**
   * Remove highlight from the currently selected charm.
   */
  _deselectCharm() {
    if (this.selectedCharm) {
      this.selectedCharm.render.strokeStyle = null;
      this.selectedCharm.render.lineWidth = 0;
      this.selectedCharm = null;
    }
  }

  /**
   * Delete the currently selected charm via CharmManager.
   * Fires `onDelete` callback after deletion.
   *
   * @private
   */
  _deleteSelected() {
    if (!this.selectedCharm) {
      return;
    }

    const bodyId = this.selectedCharm.id;

    // Break the draggedConstraint reference if it tracks this charm so
    // enddrag does not re-add an orphaned constraint after deletion.
    if (this._draggedConstraint && this._draggedConstraint.bodyB.id === bodyId) {
      this._draggedConstraint = null;
    }

    this.charmManager.removeCharm(bodyId);

    // Clear selection — selectedCharm is now invalid
    this.selectedCharm = null;

    if (typeof this.onDelete === 'function') {
      this.onDelete();
    }
  }

  /**
   * Delete the currently selected charm from the toolbar.
   * Identical to pressing Delete, but called programmatically by the toolbar.
   * Fires `onDelete` callback after deletion.
   */
  deleteByToolbar() {
    this._deleteSelected();
  }
}