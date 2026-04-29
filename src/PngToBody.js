/**
 * PngToBody — PNG contour extraction → convex decomposition → matter.js body
 *
 * Reads alpha channel from a canvas context, extracts the contour via
 * marching squares, simplifies the polygon with Ramer-Douglas-Peucker,
 * then creates a matter.js body using poly-decomp for convex decomposition.
 * Falls back to a bounding-box rectangle if contour extraction or
 * decomposition fails.
 *
 * Dependencies (loaded as globals via CDN <script> tags):
 *   - Matter   (matter-js)
 *   - decomp   (poly-decomp)
 */

export class PngToBody {

  /**
   * Extract contour from canvas alpha channel using marching squares.
   *
   * The algorithm:
   * 1. Build a binary grid from the alpha channel
   * 2. For each cell (between 4 pixels), determine the marching squares case
   * 3. Generate contour segments on cell edges
   * 4. Chain segments into an ordered polygon
   *
   * @param {CanvasRenderingContext2D} ctx  — source canvas context
   * @param {number} width   — canvas width
   * @param {number} height  — canvas height
   * @param {number} alphaThreshold — alpha value (0-255) above which a pixel is "inside"
   * @returns {Array<{x:number, y:number}>} contour points (may be empty)
   */
  static extractContour(ctx, width, height, alphaThreshold = 128) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Build binary grid: 1 = inside, 0 = outside
    const grid = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = data[(y * width + x) * 4 + 3];
        grid[y * width + x] = a >= alphaThreshold ? 1 : 0;
      }
    }

    function pixel(x, y) {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return grid[y * width + x];
    }

    const segments = [];

    const EDGE_TABLE = [
      [],              // 0:  all outside
      [[3, 2]],        // 1:  BL
      [[2, 1]],        // 2:  BR
      [[3, 1]],        // 3:  BL+BR
      [[1, 0]],        // 4:  TR
      [[3, 0], [1, 2]],// 5:  TL+BR (saddle)
      [[0, 2]],        // 6:  TR+BR
      [[3, 0]],        // 7:  TL outside
      [[0, 3]],        // 8:  TL
      [[0, 2]],        // 9:  TR outside (same contour path as 6)
      [[0, 1], [2, 3]],// 10: TL+BR (saddle, alternate)
      [[0, 1]],        // 11: BR outside
      [[1, 3]],        // 12: TL+TR
      [[1, 2]],        // 13: BR outside (same contour path as 2)
      [[2, 3]],        // 14: BL outside (same contour path as 1)
      [],              // 15: all inside
    ];

    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        const tl = pixel(cx, cy);
        const tr = pixel(cx + 1, cy);
        const br = pixel(cx + 1, cy + 1);
        const bl = pixel(cx, cy + 1);
        const index = (tl << 3) | (tr << 2) | (br << 1) | bl;

        const edges = EDGE_TABLE[index];
        for (const [e1, e2] of edges) {
          const p1 = PngToBody._edgeMidpoint(cx, cy, e1);
          const p2 = PngToBody._edgeMidpoint(cx, cy, e2);
          segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        }
      }
    }

    if (segments.length === 0) return [];
    return PngToBody._chainSegments(segments);
  }

  static _edgeMidpoint(cx, cy, edge) {
    switch (edge) {
      case 0: return { x: cx + 0.5, y: cy };      // top
      case 1: return { x: cx + 1, y: cy + 0.5 };  // right
      case 2: return { x: cx + 0.5, y: cy + 1 }; // bottom
      case 3: return { x: cx, y: cy + 0.5 };      // left
    }
  }

  static _chainSegments(segments) {
    if (segments.length === 0) return [];

    const map = new Map();
    function key(x, y) {
      return (Math.round(x * 10)) + '_' + (Math.round(y * 10));
    }

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const k1 = key(s.x1, s.y1);
      const k2 = key(s.x2, s.y2);
      if (!map.has(k1)) map.set(k1, []);
      if (!map.has(k2)) map.set(k2, []);
      map.get(k1).push({ segIndex: i, role: 'start' });
      map.get(k2).push({ segIndex: i, role: 'end' });
    }

    const used = new Set();
    const chains = [];

    for (let startIdx = 0; startIdx < segments.length; startIdx++) {
      if (used.has(startIdx)) continue;

      used.add(startIdx);
      const points = [];
      points.push({ x: segments[startIdx].x1, y: segments[startIdx].y1 });
      points.push({ x: segments[startIdx].x2, y: segments[startIdx].y2 });

      let changed = true;
      while (changed) {
        changed = false;
        const lastPt = points[points.length - 1];
        const lastKey = key(lastPt.x, lastPt.y);
        const candidates = map.get(lastKey) || [];
        for (const c of candidates) {
          if (used.has(c.segIndex)) continue;
          const s = segments[c.segIndex];
          used.add(c.segIndex);
          points.push(c.role === 'start' ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 });
          changed = true;
          break;
        }
      }

      changed = true;
      while (changed) {
        changed = false;
        const firstPt = points[0];
        const firstKey = key(firstPt.x, firstPt.y);
        const candidates = map.get(firstKey) || [];
        for (const c of candidates) {
          if (used.has(c.segIndex)) continue;
          const s = segments[c.segIndex];
          used.add(c.segIndex);
          points.unshift(c.role === 'start' ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 });
          changed = true;
          break;
        }
      }

      chains.push(points);
    }

    if (chains.length === 1) return chains[0];

    let bestChain = chains[0];
    let bestArea = Math.abs(PngToBody._shoelaceArea(chains[0]));
    for (let i = 1; i < chains.length; i++) {
      const area = Math.abs(PngToBody._shoelaceArea(chains[i]));
      if (area > bestArea) {
        bestArea = area;
        bestChain = chains[i];
      }
    }
    return bestChain;
  }

  static _shoelaceArea(points) {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return area / 2;
  }

  static simplifyPolygon(points, epsilon = 1.0) {
    if (points.length === 0) return [];
    if (points.length <= 3) return points.slice();

    const EPS_SQ = 1e-10;
    let closed = false;
    let workPoints = points;
    const first = points[0];
    const last = points[points.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (dx * dx + dy * dy < EPS_SQ) {
      closed = true;
      workPoints = points.slice(0, points.length - 1);
    }

    if (workPoints.length <= 2) return points.slice();

    const simplified = PngToBody._rdp(workPoints, epsilon);

    if (closed && simplified.length > 0) {
      simplified.push({ x: simplified[0].x, y: simplified[0].y });
    }
    return simplified;
  }

  static _rdp(points, epsilon) {
    if (points.length <= 2) return points.slice();

    const first = points[0];
    const last = points[points.length - 1];

    let maxDist = 0;
    let maxIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const d = PngToBody._perpendicularDistance(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }

    if (maxDist > epsilon) {
      const left = PngToBody._rdp(points.slice(0, maxIndex + 1), epsilon);
      const right = PngToBody._rdp(points.slice(maxIndex), epsilon);
      return left.slice(0, -1).concat(right);
    } else {
      return [first, last];
    }
  }

  static _perpendicularDistance(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      const ex = p.x - a.x;
      const ey = p.y - a.y;
      return Math.sqrt(ex * ex + ey * ey);
    }

    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const ex = p.x - projX;
    const ey = p.y - projY;
    return Math.sqrt(ex * ex + ey * ey);
  }

  /**
   * Create a matter.js body from canvas image data.
   *
   * @param {CanvasRenderingContext2D} ctx  — source canvas context
   * @param {number} width   — canvas width
   * @param {number} height  — canvas height
   * @param {Object} options — { x, y, scale, density, texturePath, fallbackWidth, fallbackHeight, attachPoint }
   * @returns {Matter.Body} matter.js body
   */
  static createBody(ctx, width, height, options = {}) {
    const {
      x = 0,
      y = 0,
      scale = 1.0,
      density = 0.001,
      texturePath = null,
      fallbackWidth = 64,
      fallbackHeight = 64,
      attachPoint = null,
    } = options;

    if (typeof decomp !== 'undefined') {
      Matter.Common.setDecomp(decomp);
    }

    const body = PngToBody._tryCreateFromContour(ctx, width, height, x, y, scale, density);

    if (body) {
      if (texturePath) {
        body.render.sprite.texture = texturePath;
        body.render.sprite.xScale = scale;
        body.render.sprite.yScale = scale;
      }
      // Store attach point on body for CharmManager to use
      if (attachPoint) {
        body._attachPoint = { x: attachPoint.x * scale, y: attachPoint.y * scale };
      }
      return body;
    }

    // Fallback: bounding box rectangle
    return PngToBody._createFallback(x, y, fallbackWidth, fallbackHeight, scale, density, texturePath, attachPoint);
  }

  static _tryCreateFromContour(ctx, width, height, x, y, scale, density) {
    try {
      const contour = PngToBody.extractContour(ctx, width, height, 128);
      if (contour.length < 3) return null;

      const simplified = PngToBody.simplifyPolygon(contour, 1.0);
      if (simplified.length < 3) return null;

      let vertices = simplified.map(p => ({ x: p.x * scale, y: p.y * scale }));

      // Strip duplicate closing vertex if present
      if (vertices.length >= 2) {
        const first = vertices[0];
        const last = vertices[vertices.length - 1];
        const EPS_SQ = 1e-10;
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        if (dx * dx + dy * dy < EPS_SQ) {
          vertices = vertices.slice(0, vertices.length - 1);
        }
      }

      const body = Matter.Bodies.fromVertices(x, y, vertices, { density });
      if (!body) return null;
      return body;
    } catch (_e) {
      return null;
    }
  }

  static _createFallback(x, y, width, height, scale, density, texturePath, attachPoint) {
    const body = Matter.Bodies.rectangle(x, y, width * scale, height * scale, { density });
    if (texturePath) {
      body.render.sprite.texture = texturePath;
      body.render.sprite.xScale = scale;
      body.render.sprite.yScale = scale;
    }
    if (attachPoint) {
      body._attachPoint = { x: attachPoint.x * scale, y: attachPoint.y * scale };
    }
    return body;
  }

  /**
   * Find the topmost opaque pixel in a PNG — the "attachment point" (loop/hook).
   * Scans the top 25% of the image, finds the leftmost opaque pixel in the topmost
   * row, and returns its position relative to the body center.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   * @param {number} alphaThreshold
   * @returns {{x:number, y:number}} attachment point relative to body center
   */
  static findTopAttachPoint(ctx, width, height, alphaThreshold = 128) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const scanHeight = Math.floor(height * 0.25);

    let topY = -1;
    let topX = -1;

    for (let y = 0; y < scanHeight; y++) {
      for (let x = 0; x < width; x++) {
        const a = data[(y * width + x) * 4 + 3];
        if (a >= alphaThreshold) {
          topY = y;
          // Find leftmost opaque pixel at this y
          for (let lx = 0; lx < width; lx++) {
            const la = data[(y * width + lx) * 4 + 3];
            if (la >= alphaThreshold) {
              topX = lx;
              break;
            }
          }
          break;
        }
      }
      if (topY !== -1) break;
    }

    if (topY === -1) {
      // No opaque pixel in top 25% — use top-center as fallback
      return { x: 0, y: -height / 2 };
    }

    // Convert from image coords to body-local coords (center at 0,0)
    const cx = width / 2;
    const cy = height / 2;
    return {
      x: topX - cx,
      y: topY - cy,
    };
  }
}
