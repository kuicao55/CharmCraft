/**
 * CharmManager — Manages charm bodies and their constraints to the ring
 *
 * Handles adding/removing charm bodies with spring constraints connected to
 * the ring. Enforces a maximum of 20 charms. Provides reconnection of all
 * constraints when the ring is replaced.
 *
 * Dependencies (loaded as globals via CDN <script> tags):
 *   - Matter   (matter-js)
 */

export class CharmManager {

  /** Maximum number of charms allowed */
  static maxCharms = 20;

  /**
   * Create a new CharmManager.
   *
   * @param {PhysicsScene} scene  — the physics scene to manage
   */
  constructor(scene) {
    this.scene = scene;
    this._constraints = [];
    // Auto-register with the scene so replaceRing always reconnects
    scene.setCharmManager(this);
  }

  /**
   * Get all constraints managed by this CharmManager.
   *
   * @returns {Array<Matter.Constraint>}
   */
  get constraints() {
    return this._constraints;
  }

  /**
   * Add a charm body with a constraint connecting it to the ring.
   * The body is also added to the physics world automatically.
   *
   * @param {Matter.Body} body               — the charm body to add
   * @param {number} constraintLength        — length of the constraint spring
   * @returns {boolean}  true if added, false if max limit reached or body already added
   */
  addCharm(body, constraintLength = 80) {
    if (this._constraints.length >= CharmManager.maxCharms) {
      return false;
    }

    // Prevent duplicate body addition
    if (this._constraints.some(c => c.bodyB.id === body.id)) {
      return false;
    }

    // Add body to the physics world
    this.scene.addBody(body);

    // Create constraint from ring to charm body
    const constraint = Matter.Constraint.create({
      bodyA: this.scene.ring,
      bodyB: body,
      length: constraintLength,
      stiffness: 0.9,
      damping: 0.1,
    });

    // Add constraint to world
    Matter.Composite.add(this.scene.engine.world, constraint);

    // Track constraint
    this._constraints.push(constraint);

    return true;
  }

  /**
   * Remove a charm body and its constraint by body ID.
   *
   * @param {number} bodyId  — the ID of the charm body to remove
   */
  removeCharm(bodyId) {
    // Find the constraint associated with this body
    const constraintIndex = this._constraints.findIndex(
      c => c.bodyB.id === bodyId
    );

    if (constraintIndex === -1) {
      return;
    }

    const constraint = this._constraints[constraintIndex];

    // Remove constraint from world
    Matter.Composite.remove(this.scene.engine.world, constraint);

    // Remove body from world
    Matter.Composite.remove(this.scene.engine.world, constraint.bodyB);

    // Remove from tracking array
    this._constraints.splice(constraintIndex, 1);
  }

  /**
   * Reconnect all charm constraints to the current ring.
   * Call this after replaceRing() to update all constraints.
   */
  reconnectAllConstraints() {
    for (const constraint of this._constraints) {
      // Remove old constraint from world
      Matter.Composite.remove(this.scene.engine.world, constraint);

      // Update bodyA reference to current ring
      constraint.bodyA = this.scene.ring;

      // Add updated constraint back to world
      Matter.Composite.add(this.scene.engine.world, constraint);
    }
  }
}
