/**
 * PngToBody.test.js — Browser-based tests for PngToBody
 *
 * This module is designed to run inside a browser context where
 * Matter and decomp are available as globals (loaded via CDN).
 * It is imported by test-runner.html.
 *
 * Exported: runAllTests(resultsEl) -> { passed, failed, failures }
 */
import { PngToBody } from '../src/PngToBody.js';

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

  function createCanvasWithRect(width, height, rx, ry, rw, rh) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'white';
    ctx.fillRect(rx, ry, rw, rh);
    return { canvas, ctx };
  }

  function createTransparentCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    return { canvas, ctx };
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

  // --- extractContour tests ---
  runTest('extractContour', function testExtractContour() {
    const { ctx } = createCanvasWithRect(100, 100, 10, 10, 50, 50);
    const contour = PngToBody.extractContour(ctx, 100, 100, 128);

    assert(Array.isArray(contour), 'extractContour returns an array');
    assert(contour.length > 0, 'extractContour returns non-empty array for solid shape');
    assert(contour.length >= 4, 'extractContour returns at least 4 points for a square');

    if (contour.length > 0) {
      assert(typeof contour[0].x === 'number', 'contour point has numeric x');
      assert(typeof contour[0].y === 'number', 'contour point has numeric y');
    }

    const { ctx: emptyCtx } = createTransparentCanvas(100, 100);
    const emptyContour = PngToBody.extractContour(emptyCtx, 100, 100, 128);
    assert(Array.isArray(emptyContour), 'extractContour returns array for empty canvas');
    assert(emptyContour.length === 0, 'extractContour returns empty array for transparent canvas');
  });

  // --- simplifyPolygon tests ---
  runTest('simplifyPolygon', function testSimplifyPolygon() {
    const points = [];
    const size = 100;
    const step = 5;
    for (let x = 0; x <= size; x += step) points.push({ x, y: 0 });
    for (let y = step; y <= size; y += step) points.push({ x: size, y });
    for (let x = size - step; x >= 0; x -= step) points.push({ x, y: size });
    for (let y = size - step; y > 0; y -= step) points.push({ x: 0, y });

    const originalCount = points.length;
    const simplified = PngToBody.simplifyPolygon(points, 1.0);

    assert(Array.isArray(simplified), 'simplifyPolygon returns an array');
    assert(simplified.length < originalCount, `simplifyPolygon reduces point count (was ${originalCount}, now ${simplified.length})`);
    assert(simplified.length >= 3, 'simplifyPolygon keeps at least 3 points');

    if (simplified.length > 0) {
      assert(typeof simplified[0].x === 'number', 'simplified point has numeric x');
      assert(typeof simplified[0].y === 'number', 'simplified point has numeric y');
    }

    assert(simplified.length <= 8, `simplifyPolygon on a dense square yields <= 8 points (got ${simplified.length})`);

    const emptyResult = PngToBody.simplifyPolygon([], 1.0);
    assert(Array.isArray(emptyResult) && emptyResult.length === 0, 'simplifyPolygon handles empty array');

    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const triResult = PngToBody.simplifyPolygon(tri, 1.0);
    assert(triResult.length === 3, 'simplifyPolygon keeps all 3 points of a triangle');
  });

  // --- simplifyPolygon closed contour tests ---
  runTest('simplifyPolygonClosedContour', function testSimplifyPolygonClosedContour() {
    // A square contour where the last point equals the first (closed loop),
    // as extractContour can return. Without the fix, RDP degenerates because
    // first === last, causing distance calculations to collapse the polygon.
    //
    // When first===last, _perpendicularDistance treats the line as zero-length,
    // so it returns Euclidean distance from each point to first. With a small
    // epsilon like 1.0, a 10x10 square's corners are ~14 units from (0,0), so
    // RDP will still find points above epsilon — but the resulting simplified
    // polygon will be WRONG (warped/distorted) even if it has enough points.
    //
    // The real test: closed contour should produce the SAME result as the
    // equivalent open contour (just without the duplicate last point).
    const closedSquare = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
      { x: 0, y: 0 },  // duplicate of first point (closed loop)
    ];

    const openSquare = closedSquare.slice(0, closedSquare.length - 1);

    const closedResult = PngToBody.simplifyPolygon(closedSquare, 1.0);
    const openResult = PngToBody.simplifyPolygon(openSquare, 1.0);

    // Both should produce a polygon with at least 4 points
    assert(closedResult.length >= 4, `closed square simplifies to at least 4 points (got ${closedResult.length}), not collapsed`);
    assert(openResult.length >= 4, `open square simplifies to at least 4 points (got ${openResult.length})`);

    // The closed result should have exactly one more point than the open result
    // (the re-appended closing point)
    assert(closedResult.length === openResult.length + 1,
      `closed result has one more point than open (closed=${closedResult.length}, open=${openResult.length})`);

    // The result should still be a closed polygon — last point should equal first
    const first = closedResult[0];
    const lastPt = closedResult[closedResult.length - 1];
    const closeDist = Math.sqrt((first.x - lastPt.x) ** 2 + (first.y - lastPt.y) ** 2);
    assert(closeDist < 0.01, `closed contour result is still closed (first-last dist=${closeDist})`);
  });

  // --- simplifyPolygon closed contour with many points ---
  runTest('simplifyPolygonDenseClosedContour', function testSimplifyPolygonDenseClosedContour() {
    // A dense closed square: many points along edges, last point = first point
    const points = [];
    const size = 100;
    const step = 5;
    for (let x = 0; x <= size; x += step) points.push({ x, y: 0 });
    for (let y = step; y <= size; y += step) points.push({ x: size, y });
    for (let x = size - step; x >= 0; x -= step) points.push({ x, y: size });
    for (let y = size - step; y >= 0; y -= step) points.push({ x: 0, y });
    // Add the duplicate closing point
    points.push({ x: 0, y: 0 });

    const simplified = PngToBody.simplifyPolygon(points, 1.0);
    assert(simplified.length >= 4, `dense closed square simplifies to at least 4 points (got ${simplified.length}), not collapsed`);

    // Result should be closed
    const first = simplified[0];
    const lastPt = simplified[simplified.length - 1];
    const closeDist = Math.sqrt((first.x - lastPt.x) ** 2 + (first.y - lastPt.y) ** 2);
    assert(closeDist < 0.01, `dense closed contour result is still closed (first-last dist=${closeDist})`);
  });

  // --- extractContour selects largest region ---
  runTest('extractContourLargestRegion', function testExtractContourLargestRegion() {
    // Create a canvas with two disconnected opaque regions:
    //   - Small region: 10x10 square at (5,5)
    //   - Large region: 30x30 square at (50,50)
    // extractContour should return the contour of the larger region.
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 100, 100);

    // Small region (10x10)
    ctx.fillStyle = 'white';
    ctx.fillRect(5, 5, 10, 10);

    // Large region (30x30)
    ctx.fillRect(50, 50, 30, 30);

    const contour = PngToBody.extractContour(ctx, 100, 100, 128);

    assert(contour.length > 0, 'extractContour returns non-empty contour for two-region canvas');

    // The contour should belong to the large region, so all contour points
    // should be near the large region (x roughly 50..80, y roughly 50..80).
    // If the small region were returned, points would be near (5..15, 5..15).
    const avgX = contour.reduce((sum, p) => sum + p.x, 0) / contour.length;
    const avgY = contour.reduce((sum, p) => sum + p.y, 0) / contour.length;

    // Large region center is ~(65, 65); small region center is ~(10, 10)
    assert(avgX > 40, `contour average x is near large region (avgX=${avgX.toFixed(1)}, expected > 40)`);
    assert(avgY > 40, `contour average y is near large region (avgY=${avgY.toFixed(1)}, expected > 40)`);
  });

  // --- createBody tests ---
  runTest('createBody', function testCreateBody() {
    const { ctx } = createCanvasWithRect(100, 100, 10, 10, 50, 50);

    Matter.Common.setDecomp(decomp);

    const body = PngToBody.createBody(ctx, 100, 100, {
      x: 200,
      y: 300,
      scale: 1.0,
      density: 0.001,
      texturePath: null
    });

    assert(body !== null && body !== undefined, 'createBody returns a body');
    assert(typeof body === 'object', 'createBody returns an object');
    assert(body.position !== undefined, 'body has position property (is a matter.js body)');

    assertApprox(body.position.x, 200, 5, 'body positioned at correct x');
    assertApprox(body.position.y, 300, 5, 'body positioned at correct y');
  });

  // --- createBody fallback tests ---
  runTest('createBodyFallback', function testCreateBodyFallback() {
    const { ctx } = createTransparentCanvas(100, 100);

    Matter.Common.setDecomp(decomp);

    const body = PngToBody.createBody(ctx, 100, 100, {
      x: 150,
      y: 250,
      scale: 1.0,
      density: 0.001,
      fallbackWidth: 80,
      fallbackHeight: 60,
      texturePath: null
    });

    assert(body !== null && body !== undefined, 'createBody fallback returns a body for transparent canvas');
    assert(typeof body === 'object', 'createBody fallback returns an object');
    assert(body.position !== undefined, 'fallback body has position (is a matter.js body)');
    assertApprox(body.position.x, 150, 5, 'fallback body positioned at correct x');
    assertApprox(body.position.y, 250, 5, 'fallback body positioned at correct y');
  });

  // --- createBody with texturePath tests ---
  runTest('createBodyWithTexture', function testCreateBodyWithTexture() {
    const { ctx } = createCanvasWithRect(100, 100, 10, 10, 50, 50);

    Matter.Common.setDecomp(decomp);

    const body = PngToBody.createBody(ctx, 100, 100, {
      x: 100,
      y: 100,
      scale: 1.0,
      density: 0.001,
      texturePath: 'assets/charm.png'
    });

    assert(body !== null, 'createBody with texture returns a body');
    assert(
      body.render && body.render.sprite && body.render.sprite.texture === 'assets/charm.png',
      'body has render.sprite.texture set correctly'
    );
  });

  // --- createBody fallback with scale tests ---
  runTest('createBodyFallbackWithScale', function testCreateBodyFallbackWithScale() {
    const { ctx } = createTransparentCanvas(100, 100);

    Matter.Common.setDecomp(decomp);

    const scale = 0.5;
    const fallbackWidth = 80;
    const fallbackHeight = 60;

    const body = PngToBody.createBody(ctx, 100, 100, {
      x: 150,
      y: 250,
      scale: scale,
      density: 0.001,
      fallbackWidth: fallbackWidth,
      fallbackHeight: fallbackHeight,
      texturePath: null
    });

    assert(body !== null && body !== undefined, 'scaled fallback body exists');

    // Verify the fallback rectangle dimensions account for scale.
    // matter.js Bodies.rectangle creates a body whose bounds span the given
    // width and height. With scale=0.5, an 80x60 fallback should become 40x30.
    const actualWidth = body.bounds.max.x - body.bounds.min.x;
    const actualHeight = body.bounds.max.y - body.bounds.min.y;
    const expectedWidth = fallbackWidth * scale;
    const expectedHeight = fallbackHeight * scale;

    assertApprox(actualWidth, expectedWidth, 1,
      `scaled fallback width is ~${expectedWidth} (got ${actualWidth})`);
    assertApprox(actualHeight, expectedHeight, 1,
      `scaled fallback height is ~${expectedHeight} (got ${actualHeight})`);
  });

  // --- _tryCreateFromContour strips duplicate closing vertex before fromVertices ---
  // After simplifyPolygon re-closes a closed contour (last === first),
  // _tryCreateFromContour must strip the duplicate BEFORE calling
  // Matter.Bodies.fromVertices. If the duplicate is passed through,
  // poly-decomp can reject the polygon and return null even for valid shapes.
  // We use a shallow copy in the mock to capture the vertices BEFORE fromVertices
  // mutates the array in-place.
  runTest('_tryCreateFromContourStripsDuplicateClosingVertex', function testTryCreateFromContourStripsDuplicateClosingVertex() {
    const { ctx } = createCanvasWithRect(100, 100, 10, 10, 50, 50);

    Matter.Common.setDecomp(decomp);

    // Verify simplifyPolygon produces a closed polygon (last === first)
    const contour = PngToBody.extractContour(ctx, 100, 100, 128);
    const simplified = PngToBody.simplifyPolygon(contour, 1.0);
    assert(simplified.length >= 3, 'simplified has at least 3 points');
    const firstPt = simplified[0];
    const lastPt = simplified[simplified.length - 1];
    const closeDist = Math.sqrt((firstPt.x - lastPt.x) ** 2 + (firstPt.y - lastPt.y) ** 2);
    assert(closeDist < 0.01,
      `simplified is closed (first-last dist=${closeDist.toFixed(4)})`);

    // Intercept Matter.Bodies.fromVertices. Capture a shallow copy of the
    // vertices array BEFORE the original function mutates it in-place.
    // The captured array must be OPEN (last !== first) — the duplicate closing
    // vertex must have been stripped before fromVertices is called.
    let capturedVertices = null;
    const originalFromVertices = Matter.Bodies.fromVertices;
    Matter.Bodies.fromVertices = function(x, y, verts, opts) {
      // Shallow copy so we snapshot the state BEFORE any in-place mutation
      capturedVertices = verts.slice();
      return originalFromVertices.call(Matter.Bodies, x, y, verts, opts);
    };

    try {
      const body = PngToBody.createBody(ctx, 100, 100, {
        x: 50, y: 50, scale: 1.0, density: 0.001, texturePath: null
      });

      assert(body !== null, 'body was created');

      assert(capturedVertices !== null,
        'Matter.Bodies.fromVertices was called and captured');

      assert(capturedVertices.length >= 3,
        `captured vertices has at least 3 points (got ${capturedVertices.length})`);

      const capFirst = capturedVertices[0];
      const capLast = capturedVertices[capturedVertices.length - 1];
      const capDist = Math.sqrt((capFirst.x - capLast.x) ** 2 + (capFirst.y - capLast.y) ** 2);
      assert(capDist >= 0.01,
        `captured vertices is OPEN — last != first (dist=${capDist.toFixed(4)}) — duplicate was stripped`);
    } finally {
      Matter.Bodies.fromVertices = originalFromVertices;
    }
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
