/**
 * PhysicsScene.test.js — Browser-based tests for PhysicsScene and CharmManager
 *
 * This module is designed to run inside a browser context where
 * Matter is available as a global (loaded via CDN).
 * It is imported by PhysicsScene.test.html.
 *
 * Exported: runAllTests(resultsEl) -> { passed, failed, failures }
 */
import { PhysicsScene } from '../src/PhysicsScene.js';
import { CharmManager } from '../src/CharmManager.js';

export function runAllTests(resultsEl) {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(condition, message) {
    if (condition) {
      passed++;
      resultsEl.innerHTML += `<div class="pass">PASS: ${message}</div>`;
    } else {
      failed++;
      failures.push(message);
      resultsEl.innerHTML += `<div class="fail">FAIL: ${message}</div>`;
    }
  }

  function assertApprox(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    assert(diff <= tolerance, `${message} (expected ~${expected}, got ${actual}, diff=${diff})`);
  }

  function runTest(name, fn) {
    try {
      fn();
    } catch (e) {
      failed++;
      failures.push(`${name}: ${e.message}`);
      resultsEl.innerHTML += `<div class="fail">ERROR in ${name}: ${e.message}</div>`;
    }
  }

  // --- PhysicsScene tests ---

  runTest('PhysicsScene creates engine, render, runner', function testPhysicsSceneCreation() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    assert(scene !== null && scene !== undefined, 'PhysicsScene constructor returns an object');
    assert(scene.engine !== undefined, 'PhysicsScene has engine property');
    assert(scene.render !== undefined, 'PhysicsScene has render property');
    assert(scene.runner !== undefined, 'PhysicsScene has runner property');

    // Verify these are matter.js objects by checking their type property
    assert(typeof scene.engine.world !== 'undefined', 'engine.world exists (is Matter.Engine)');
    assert(typeof scene.render.canvas !== 'undefined', 'render.canvas exists (is Matter.Render)');
    assert(typeof scene.runner.enabled !== 'undefined', 'runner.enabled exists (is Matter.Runner)');

    // Cleanup
    scene.stop();
  });

  runTest('PhysicsScene creates default ring (static, centered at top)', function testPhysicsSceneDefaultRing() {
    const container = document.getElementById('canvas-container');
    const width = 400;
    const height = 600;
    const scene = new PhysicsScene(container, { width, height });

    assert(scene.ring !== undefined, 'PhysicsScene has ring property');
    assert(scene.ring !== null, 'PhysicsScene ring is not null');

    // Ring should be static
    assert(scene.ring.isStatic === true, 'ring body is static');

    // Ring should be centered horizontally at top
    assertApprox(scene.ring.position.x, width / 2, 5, 'ring centered horizontally');
    assertApprox(scene.ring.position.y, 60, 5, 'ring at top (y ~ 60)');

    // Ring should be a circle
    assert(scene.ring.circleRadius !== undefined, 'ring has circleRadius');

    // Cleanup
    scene.stop();
  });

  runTest('PhysicsScene start is idempotent (calling start() twice is a no-op)', function testPhysicsSceneStartIdempotent() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    // Start once
    scene.start();

    // Start again — should be a no-op, not an error
    scene.start();

    // Cleanup
    scene.stop();
  });

  runTest('PhysicsScene start/stop methods', function testPhysicsSceneStartStop() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    assert(typeof scene.start === 'function', 'start is a function');
    assert(typeof scene.stop === 'function', 'stop is a function');

    // Start should not throw
    scene.start();

    // Stop should not throw
    scene.stop();
  });

  runTest('PhysicsScene addBody and removeBody', function testPhysicsSceneAddRemoveBody() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const testBody = Matter.Bodies.circle(100, 100, 20, { isStatic: true });

    scene.addBody(testBody);

    // Body should be in the world
    const bodies = Matter.Composite.allBodies(scene.engine.world);
    assert(bodies.some(b => b.id === testBody.id), 'added body is in the world');

    scene.removeBody(testBody);

    // Body should no longer be in the world
    const bodiesAfter = Matter.Composite.allBodies(scene.engine.world);
    assert(!bodiesAfter.some(b => b.id === testBody.id), 'removed body is not in the world');

    // Cleanup
    scene.stop();
  });

  runTest('PhysicsScene replaceRing auto-reconnects constraints when CharmManager is registered via setCharmManager', function testPhysicsSceneReplaceRingAutoReconnect() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    // Add a charm — addCharm auto-adds body
    const charmBody = Matter.Bodies.circle(150, 200, 15);
    manager.addCharm(charmBody, 80);

    const oldConstraint = manager.constraints[0];
    assert(oldConstraint.bodyA.id === scene.ring.id, 'constraint bodyA is original ring');

    // Replace the ring — should auto-reconnect without passing charmManager
    const newRing = Matter.Bodies.circle(250, 100, 35, { isStatic: true });
    scene.replaceRing(newRing);

    // Constraint should already point to new ring — no manual reconnect needed
    assert(manager.constraints.length === 1, 'still one constraint after replace');
    const newConstraint = manager.constraints[0];
    assert(newConstraint.bodyA.id === newRing.id, 'constraint bodyA is the new ring (auto-reconnected)');
    assert(newConstraint.bodyB.id === charmBody.id, 'constraint bodyB is still the charm');

    // Cleanup
    scene.destroy();
  });

  runTest('PhysicsScene replaceRing auto-reconnects constraints by default (auto-registration)', function testPhysicsSceneReplaceRingAutoReconnectByDefault() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    // CharmManager auto-registers with the scene in its constructor,
    // so replaceRing should auto-reconnect without any manual setCharmManager call
    const charmBody = Matter.Bodies.circle(150, 200, 15);
    manager.addCharm(charmBody, 80);

    const oldConstraint = manager.constraints[0];
    assert(oldConstraint.bodyA.id === scene.ring.id, 'constraint bodyA is original ring before replace');

    // Replace the ring — auto-reconnect should happen via auto-registration
    const newRing = Matter.Bodies.circle(250, 100, 35, { isStatic: true });
    scene.replaceRing(newRing);

    // Constraint should already point to new ring
    assert(manager.constraints[0].bodyA.id === newRing.id, 'constraint bodyA is new ring (auto-reconnected)');
    assert(manager.constraints[0].bodyB.id === charmBody.id, 'constraint bodyB is still the charm');

    // Cleanup
    scene.destroy();
  });

  runTest('PhysicsScene replaceRing replaces the ring', function testPhysicsSceneReplaceRing() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const oldRing = scene.ring;
    const oldRingId = oldRing.id;

    // Create a new ring at a different position
    const newRing = Matter.Bodies.circle(200, 200, 30, { isStatic: true });

    scene.replaceRing(newRing);

    // New ring should be in the world
    const bodies = Matter.Composite.allBodies(scene.engine.world);
    assert(bodies.some(b => b.id === newRing.id), 'new ring is in the world');

    // Old ring should not be in the world
    assert(!bodies.some(b => b.id === oldRingId), 'old ring is not in the world');

    // Scene should reference the new ring
    assert(scene.ring.id === newRing.id, 'scene.ring references the new ring');

    // Cleanup
    scene.stop();
  });

  // --- CharmManager tests ---

  runTest('CharmManager constructor', function testCharmManagerConstructor() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    assert(manager !== null && manager !== undefined, 'CharmManager constructor returns an object');
    assert(manager.constraints !== undefined, 'CharmManager has constraints property');
    assert(Array.isArray(manager.constraints), 'constraints is an array');

    // Cleanup
    scene.stop();
  });

  runTest('CharmManager addCharm auto-adds body to physics world', function testCharmManagerAddCharmAutoAdd() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    const charmBody = Matter.Bodies.circle(150, 200, 15);

    // addCharm should add the body automatically — no need to call scene.addBody first
    const result = manager.addCharm(charmBody, 80);

    assert(result === true, 'addCharm returns true on success');

    // Body should be in the world even though we never called scene.addBody
    const bodies = Matter.Composite.allBodies(scene.engine.world);
    assert(bodies.some(b => b.id === charmBody.id), 'addCharm auto-added body to the world');

    // Cleanup
    scene.stop();
  });

  runTest('CharmManager addCharm creates constraint', function testCharmManagerAddCharm() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    const charmBody = Matter.Bodies.circle(150, 200, 15);

    // addCharm now auto-adds the body — no scene.addBody needed
    const result = manager.addCharm(charmBody, 80);

    assert(result === true, 'addCharm returns true on success');
    assert(manager.constraints.length === 1, 'constraints has one constraint');

    const constraint = manager.constraints[0];
    assert(constraint !== undefined, 'constraint exists');
    assert(constraint.bodyA !== undefined, 'constraint has bodyA');
    assert(constraint.bodyB !== undefined, 'constraint has bodyB');

    // Constraint should connect ring (bodyA) to charm (bodyB)
    assert(constraint.bodyA.id === scene.ring.id, 'constraint bodyA is the ring');
    assert(constraint.bodyB.id === charmBody.id, 'constraint bodyB is the charm');

    // Constraint should be added to the world
    const worldConstraints = Matter.Composite.allConstraints(scene.engine.world);
    assert(worldConstraints.some(c => c.id === constraint.id), 'constraint is in the world');

    // Cleanup
    scene.stop();
  });

  runTest('CharmManager addCharm respects max limit of 20', function testCharmManagerMaxLimit() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    // Add 20 charms successfully
    for (let i = 0; i < 20; i++) {
      const charmBody = Matter.Bodies.circle(100 + i * 5, 200 + i * 5, 15);
      const result = manager.addCharm(charmBody, 80);
      assert(result === true, `addCharm returns true for charm ${i + 1}`);
    }

    assert(manager.constraints.length === 20, 'constraints has 20 items at max');

    // 21st charm should fail
    const overflowCharm = Matter.Bodies.circle(300, 300, 15);
    const overflowResult = manager.addCharm(overflowCharm, 80);

    assert(overflowResult === false, 'addCharm returns false when max (20) reached');
    assert(manager.constraints.length === 20, 'constraints still has 20 items after overflow attempt');

    // Cleanup
    scene.stop();
  });

  runTest('CharmManager removeCharm removes body and constraint', function testCharmManagerRemoveCharm() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    const charmBody = Matter.Bodies.circle(150, 200, 15);
    // addCharm now auto-adds the body
    manager.addCharm(charmBody, 80);

    assert(manager.constraints.length === 1, 'one constraint before removal');

    // Remove the charm
    manager.removeCharm(charmBody.id);

    assert(manager.constraints.length === 0, 'no constraints after removal');

    // Charm body should be removed from world
    const bodies = Matter.Composite.allBodies(scene.engine.world);
    const ringBodies = bodies.filter(b => !b.isStatic);
    assert(!ringBodies.some(b => b.id === charmBody.id), 'charm body removed from world');

    // Constraint should be removed from world
    const worldConstraints = Matter.Composite.allConstraints(scene.engine.world);
    assert(worldConstraints.length === 0, 'no constraints in world after removal');

    // Cleanup
    scene.stop();
  });

  runTest('CharmManager reconnectAllConstraints reconnects to new ring', function testCharmManagerReconnect() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    // Add a charm — addCharm auto-adds body
    const charmBody = Matter.Bodies.circle(150, 200, 15);
    manager.addCharm(charmBody, 80);

    const oldConstraint = manager.constraints[0];
    assert(oldConstraint.bodyA.id === scene.ring.id, 'constraint bodyA is original ring');

    // Replace the ring
    const newRing = Matter.Bodies.circle(250, 100, 35, { isStatic: true });
    scene.replaceRing(newRing);

    // Reconnect constraints
    manager.reconnectAllConstraints();

    assert(manager.constraints.length === 1, 'still one constraint after reconnect');
    const newConstraint = manager.constraints[0];
    assert(newConstraint.bodyA.id === newRing.id, 'constraint bodyA is now the new ring');
    assert(newConstraint.bodyB.id === charmBody.id, 'constraint bodyB is still the charm');

    // Cleanup
    scene.stop();
  });

  runTest('CharmManager addCharm prevents duplicate body addition', function testCharmManagerDuplicatePrevention() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    const charmBody = Matter.Bodies.circle(150, 200, 15);

    // First add should succeed
    const firstResult = manager.addCharm(charmBody, 80);
    assert(firstResult === true, 'first addCharm returns true');
    assert(manager.constraints.length === 1, 'one constraint after first add');

    // Second add of same body should fail
    const secondResult = manager.addCharm(charmBody, 80);
    assert(secondResult === false, 'second addCharm returns false for duplicate body');
    assert(manager.constraints.length === 1, 'still one constraint after duplicate attempt');

    // Adding a different body should still work
    const charmBody2 = Matter.Bodies.circle(200, 250, 15);
    const thirdResult = manager.addCharm(charmBody2, 80);
    assert(thirdResult === true, 'addCharm returns true for different body');
    assert(manager.constraints.length === 2, 'two constraints after adding different body');

    // Cleanup
    scene.destroy();
  });

  runTest('PhysicsScene setCharmManager rejects manager for different scene', function testSetCharmManagerRejectsWrongScene() {
    const container = document.getElementById('canvas-container');
    const scene1 = new PhysicsScene(container, { width: 400, height: 600 });
    const scene2 = new PhysicsScene(container, { width: 400, height: 600 });

    // Create a manager for scene1
    const managerForScene1 = new CharmManager(scene1);

    // Attempting to set a manager for scene1 on scene2 should throw
    let threwError = false;
    try {
      scene2.setCharmManager(managerForScene1);
    } catch (e) {
      threwError = true;
    }
    assert(threwError === true, 'setCharmManager throws when manager belongs to different scene');

    // Setting correct manager should work
    scene1.destroy();
    scene2.destroy();
  });

  runTest('CharmManager reconnectAllConstraints with multiple charms', function testCharmManagerReconnectMultiple() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    const manager = new CharmManager(scene);

    // Add multiple charms — addCharm auto-adds bodies
    const charms = [];
    for (let i = 0; i < 5; i++) {
      const charmBody = Matter.Bodies.circle(100 + i * 20, 200, 15);
      manager.addCharm(charmBody, 80);
      charms.push(charmBody);
    }

    assert(manager.constraints.length === 5, 'five constraints before replace');

    // Replace the ring
    const newRing = Matter.Bodies.circle(200, 80, 40, { isStatic: true });
    scene.replaceRing(newRing);

    // Reconnect
    manager.reconnectAllConstraints();

    // All constraints should now point to the new ring
    for (let i = 0; i < 5; i++) {
      assert(manager.constraints[i].bodyA.id === newRing.id,
        `constraint ${i} bodyA is new ring`);
      assert(manager.constraints[i].bodyB.id === charms[i].id,
        `constraint ${i} bodyB is charm ${i}`);
    }

    // Cleanup
    scene.stop();
  });

  runTest('PhysicsScene with hidden container renders correctly', function testPhysicsSceneHiddenContainer() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    // Verify render has correct dimensions
    assert(scene.render.options.width === 400, 'render width matches');
    assert(scene.render.options.height === 600, 'render height matches');

    // Verify wireframes setting (should be false)
    assert(scene.render.options.wireframes === false, 'wireframes is false');

    // Cleanup
    scene.destroy();
  });

  runTest('PhysicsScene setCharmManager stores reference', function testSetCharmManagerStoresReference() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    assert(typeof scene.setCharmManager === 'function', 'setCharmManager is a function');

    const manager = new CharmManager(scene);

    // _charmManager should be set (private but we can infer indirectly)
    // Replace ring should trigger reconnect when CharmManager is set
    const charmBody = Matter.Bodies.circle(150, 200, 15);
    manager.addCharm(charmBody, 80);

    const newRing = Matter.Bodies.circle(250, 100, 35, { isStatic: true });
    scene.replaceRing(newRing);

    // Auto-reconnect happened, so constraint bodyA should be the new ring
    assert(manager.constraints[0].bodyA.id === newRing.id, 'auto-reconnect triggered after setCharmManager');

    // Cleanup
    scene.destroy();
  });

  runTest('PhysicsScene destroy() stops simulation and removes canvas', function testPhysicsSceneDestroy() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    assert(typeof scene.destroy === 'function', 'destroy is a function');

    scene.start();

    const canvas = scene.render.canvas;
    assert(canvas !== undefined, 'canvas exists after start');

    scene.destroy();

    // Canvas should be removed from DOM
    const parent = canvas.parentNode;
    assert(parent === null, 'canvas removed from DOM after destroy');

    // Cleanup
    scene.destroy();
  });

  runTest('PhysicsScene destroy() clears engine world', function testPhysicsSceneDestroyClearsWorld() {
    const container = document.getElementById('canvas-container');
    const scene = new PhysicsScene(container, { width: 400, height: 600 });

    // Add a body to the world
    const extraBody = Matter.Bodies.circle(200, 200, 20);
    scene.addBody(extraBody);

    let bodies = Matter.Composite.allBodies(scene.engine.world);
    const countBefore = bodies.length;
    assert(countBefore >= 2, 'world has ring and extra body before destroy');

    scene.destroy();

    // World should be cleared
    const bodiesAfter = Matter.Composite.allBodies(scene.engine.world);
    assert(bodiesAfter.length === 0, 'engine world is empty after destroy');

    // Cleanup
    scene.destroy();
  });

  // --- Summary ---
  const total = passed + failed;
  const summaryClass = failed === 0 ? 'pass' : 'fail';
  resultsEl.innerHTML += `
    <div class="summary ${summaryClass}">
      Results: ${passed}/${total} passed, ${failed} failed
    </div>
  `;
  if (failures.length > 0) {
    resultsEl.innerHTML += `<div class="fail">Failed tests:<br>${failures.map(f => '  - ' + f).join('<br>')}</div>`;
  }

  return { passed, failed, failures };
}
