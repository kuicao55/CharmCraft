/**
 * PhysicsScene — Matter.js engine, render, and runner lifecycle manager
 *
 * Manages the physics world with a default static ring body at the top-center.
 * Provides methods to start/stop the simulation, add/remove bodies, and
 * replace the ring body.
 *
 * Dependencies (loaded as globals via CDN <script> tags):
 *   - Matter   (matter-js)
 */

export class PhysicsScene {

  /**
   * Create a new physics scene.
   *
   * @param {HTMLElement} container  — DOM element to contain the canvas
   * @param {Object} options         — { width, height }
   */
  constructor(container, options = {}) {
    const width = options.width || 800;
    const height = options.height || 600;

    // Store container reference for destroy()
    this._container = container;

    // Create engine
    this.engine = Matter.Engine.create({
      enableSleeping: false,
    });

    // Create render with wireframes: false
    this.render = Matter.Render.create({
      element: container,
      engine: this.engine,
      options: {
        width,
        height,
        wireframes: false,
        background: '#f0f0f0',
      },
    });

    // Create runner
    this.runner = Matter.Runner.create();

    // Create default ring: static circle at top-center
    this.ring = Matter.Bodies.circle(width / 2, 60, 25, {
      isStatic: true,
      label: 'ring',
      render: {
        fillStyle: '#7b2cbf',
      },
    });

    // Add ring to the world
    Matter.Composite.add(this.engine.world, this.ring);

    // Track running state for idempotent start/stop
    this._started = false;

    // Reference to CharmManager for auto-reconnect on replaceRing
    this._charmManager = null;
  }

  /**
   * Start the physics simulation and rendering.
   * Idempotent: calling start() while already running is a no-op.
   */
  start() {
    if (this._started) {
      return;
    }
    // Ensure clean state before starting
    this.stop();
    Matter.Render.run(this.render);
    Matter.Runner.run(this.runner, this.engine);
    this._started = true;
  }

  /**
   * Set the CharmManager for this scene.
   * When a CharmManager is set, replaceRing() will auto-reconnect all constraints.
   *
   * @param {CharmManager} manager  — the CharmManager instance to register
   */
  setCharmManager(manager) {
    // Validate that the manager belongs to this scene
    if (manager.scene !== this) {
      console.warn('CharmManager.setCharmManager: manager.scene does not match this scene');
      throw new Error('CharmManager does not belong to this PhysicsScene');
    }
    this._charmManager = manager;
  }

  /**
   * Stop the physics simulation and rendering.
   */
  stop() {
    Matter.Render.stop(this.render);
    Matter.Runner.stop(this.runner);
    this._started = false;
  }

  /**
   * Destroy the physics scene.
   * Stops the simulation, removes the canvas from the DOM, and clears the engine world.
   */
  destroy() {
    this.stop();
    if (this.render.canvas && this.render.canvas.parentNode) {
      this.render.canvas.parentNode.removeChild(this.render.canvas);
    }
    Matter.Composite.clear(this.engine.world);
  }

  /**
   * Replace the current ring body with a new one.
   * Removes the old ring from the world and adds the new ring.
   * If a CharmManager is registered, automatically reconnects all constraints.
   *
   * @param {Matter.Body} newRing  — the new ring body
   */
  replaceRing(newRing) {
    // Remove old ring from world
    Matter.Composite.remove(this.engine.world, this.ring);

    // Add new ring to world
    Matter.Composite.add(this.engine.world, newRing);

    // Update reference
    this.ring = newRing;

    // Auto-reconnect constraints if CharmManager is registered
    if (this._charmManager) {
      this._charmManager.reconnectAllConstraints();
    }
  }

  /**
   * Add a body to the physics world.
   *
   * @param {Matter.Body} body
   */
  addBody(body) {
    Matter.Composite.add(this.engine.world, body);
  }

  /**
   * Remove a body from the physics world.
   *
   * @param {Matter.Body} body
   */
  removeBody(body) {
    Matter.Composite.remove(this.engine.world, body);
  }
}
